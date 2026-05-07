import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { PendingChanges } from '../../core/guards/pending-changes.guard';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormGroup, Validators,
  AbstractControl, AsyncValidatorFn, ValidationErrors
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { switchMap, map, catchError, first, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { UserService, PerfilUsuario } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { DateLocalePipe } from '../../shared/pipes/date-locale.pipe';
import {
  passwordFortalezaValidator,
  confirmarPasswordValidator,
  calcPwReqs,
} from '../../core/validators/password.validator';
import { extractHttpErrorMessage } from '../../shared/utils/error-utils';
import { UI_TIMINGS } from '../../shared/utils/ui-constants';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DateLocalePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit, PendingChanges {

  perfil: PerfilUsuario | null = null;
  cargando = true;
  error    = '';

  // ── Edición de perfil ─────────────────────────────────────────────
  modoEdicion  = false;
  formPerfil!: FormGroup;
  estadoPerfil: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajePerfil = '';

  // ── Cambio de contraseña ──────────────────────────────────────────
  modoPasswordAbierto = false;
  formPassword!: FormGroup;
  showNuevaPassword   = false;
  showConfirmPassword = false;
  estadoPassword: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajePassword = '';

  // ── Avatar ────────────────────────────────────────────────────────
  avatarPreview: string | null = null;  // objectURL temporal durante la subida
  subiendoAvatar = false;
  avatarError    = '';

  // ── Copiar handle ─────────────────────────────────────────────────
  handleCopiado = false;

  // ── Confirmación cambio de username ───────────────────────────────
  mostrarConfirmUsername = false;

  // ── Cambio de correo ──────────────────────────────────────────────
  modoEditarEmail   = false;
  formEmail!: FormGroup;
  showPasswordEmail = false;
  estadoEmail: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajeEmail      = '';

  private readonly authApiUrl = `${environment.apiUrl}/api/auth`;
  private usuarioService = inject(UserService);
  private authService    = inject(AuthService);
  private fb             = inject(FormBuilder);
  private http           = inject(HttpClient);
  private cdr            = inject(ChangeDetectorRef);
  private destroyRef     = inject(DestroyRef);

  ngOnInit(): void {
    this.initFormPassword();
    this.cargarPerfil();
  }

  // ── Carga ─────────────────────────────────────────────────────────

  private cargarPerfil(): void {
    this.cargando = true;
    this.usuarioService.obtenerPerfil()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => { this.cargando = false; this.cdr.markForCheck(); })
      )
      .subscribe({
        next:  (p) => { this.perfil = p; this.cdr.markForCheck(); },
        error: ()  => { this.error = 'No se pudo cargar la información de perfil.'; this.cdr.markForCheck(); },
      });
  }

  // ── Edición de perfil ─────────────────────────────────────────────

  activarEdicion(): void {
    if (!this.perfil) return;
    this.formPerfil = this.fb.group({
      nombre:    [this.perfil.nombre,    Validators.required],
      apellidos: [this.perfil.apellidos, Validators.required],
      username:  [this.perfil.username,  [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
        Validators.pattern(/^[A-Za-z0-9_-]+$/),
      ], [this.usernameDisponibleValidator()]],
    });
    this.modoEdicion  = true;
    this.estadoPerfil = 'idle';
    this.mensajePerfil = '';
  }

  cancelarEdicion(): void {
    this.modoEdicion     = false;
    this.modoEditarEmail = false;
  }

  guardarPerfil(): void {
    if (this.formPerfil.invalid) { this.formPerfil.markAllAsTouched(); return; }

    const originalUsername = this.perfil?.username ?? '';
    const usernameWillChange = (this.formPerfil.value.username?.toLowerCase() ?? '') !== originalUsername.toLowerCase();

    if (usernameWillChange) {
      this.mostrarConfirmUsername = true;
      return;
    }

    this.estadoPerfil = 'loading';

    this.usuarioService.actualizarPerfil(this.formPerfil.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => {
          this.perfil      = { ...this.perfil!, ...actualizado };
          this.modoEdicion = false;
          this.authService.updateUserData(actualizado);
          this.estadoPerfil  = 'success';
          this.mensajePerfil = 'Perfil actualizado correctamente.';
          this.cdr.markForCheck();
          timer(UI_TIMINGS.FEEDBACK_SUCCESS_MS).pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => { this.estadoPerfil = 'idle'; this.cdr.markForCheck(); });
        },
        error: (err) => {
          this.estadoPerfil  = 'error';
          this.mensajePerfil = extractHttpErrorMessage(err, 'No se pudo actualizar el perfil.');
          this.cdr.markForCheck();
        },
      });
  }

  confirmarCambioUsername(): void {
    this.mostrarConfirmUsername = false;
    this.estadoPerfil = 'loading';
    this.usuarioService.actualizarPerfil(this.formPerfil.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => {
          this.estadoPerfil  = 'success';
          this.mensajePerfil = 'Nombre de usuario actualizado. Cerrando sesión...';
          this.cdr.markForCheck();
          timer(UI_TIMINGS.FEEDBACK_SHORT_MS).pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.authService.logout(
              ['/login'],
              { identificadorCambiado: '1', tag: `${actualizado.username}#${actualizado.tag}` }
            ));
        },
        error: (err) => {
          this.estadoPerfil  = 'error';
          this.mensajePerfil = extractHttpErrorMessage(err, 'No se pudo actualizar el perfil.');
          this.cdr.markForCheck();
        },
      });
  }

  cancelarConfirmUsername(): void {
    this.mostrarConfirmUsername = false;
  }

  private usernameDisponibleValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const value = (control.value ?? '').trim();
      if (!value || !/^[A-Za-z0-9_-]{3,20}$/.test(value)) return of(null);
      if (this.perfil && value.toLowerCase() === this.perfil.username.toLowerCase()) return of(null);
      return timer(500).pipe(
        switchMap(() =>
          this.http.get<{ disponible: boolean }>(
            `${this.authApiUrl}/check-username?username=${encodeURIComponent(value)}`
          )
        ),
        map(res => res.disponible ? null : { usernameSaturado: true }),
        catchError(() => of(null)),
        first(),
        takeUntilDestroyed(this.destroyRef),
      );
    };
  }

  copiarHandle(): void {
    if (!this.perfil) return;
    const handle = `${this.perfil.username}#${this.perfil.tag}`;
    navigator.clipboard.writeText(handle).then(() => {
      this.handleCopiado = true;
      this.cdr.markForCheck();
      timer(UI_TIMINGS.FEEDBACK_SHORT_MS).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => { this.handleCopiado = false; this.cdr.markForCheck(); });
    }).catch(() => { /* permisos denegados o contexto no seguro — no acción */ });
  }

  get fNombre()    { return this.formPerfil.get('nombre')!; }
  get fApellidos() { return this.formPerfil.get('apellidos')!; }
  get fUsername()  { return this.formPerfil.get('username')!; }

  // ── Cambio de contraseña ──────────────────────────────────────────

  togglePassword(): void {
    if (this.modoPasswordAbierto) {
      // Cerrar: resetear todo
      this.modoPasswordAbierto = false;
      this.estadoPassword      = 'idle';
      this.mensajePassword     = '';
      this.showNuevaPassword   = false;
      this.showConfirmPassword = false;
      this.formPassword.reset();
    } else {
      this.modoPasswordAbierto = true;
      this.estadoPassword      = 'idle';
      this.mensajePassword     = '';
      this.formPassword.reset();
    }
    this.cdr.markForCheck();
  }

  private initFormPassword(): void {
    this.formPassword = this.fb.group(
      {
        contrasenaActual:  ['', Validators.required],
        contrasenaNueva:   ['', [Validators.required, passwordFortalezaValidator()]],
        contrasenaConfirm: ['', Validators.required],
      },
      { validators: confirmarPasswordValidator('contrasenaNueva', 'contrasenaConfirm') },
    );
  }

  get ctrlActual()  { return this.formPassword.get('contrasenaActual')!; }
  get ctrlNueva()   { return this.formPassword.get('contrasenaNueva')!; }
  get ctrlConfirm() { return this.formPassword.get('contrasenaConfirm')!; }

  get pwReqsNueva() { return calcPwReqs(this.ctrlNueva.value ?? ''); }

  cambiarContrasena(): void {
    this.formPassword.markAllAsTouched();
    if (this.formPassword.invalid) return;

    const { contrasenaActual, contrasenaNueva } = this.formPassword.value;
    this.estadoPassword  = 'loading';
    this.mensajePassword = '';

    this.usuarioService.cambiarContrasena(contrasenaActual, contrasenaNueva)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.estadoPassword  = 'success';
          this.mensajePassword = 'Contraseña actualizada. Cerrando sesión...';
          this.formPassword.reset();
          timer(UI_TIMINGS.FEEDBACK_SHORT_MS).pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.authService.logout());
        },
        error: (err) => {
          const body = err?.error;
          if (body?.error === 'La contraseña actual no es correcta') {
            this.estadoPassword = 'idle';
            this.ctrlActual.setErrors({ incorrecta: true });
          } else {
            this.estadoPassword  = 'error';
            // body.campos.nueva contiene el mensaje de validación de campo del backend (Spring)
            this.mensajePassword = body?.campos?.['nueva'] ?? extractHttpErrorMessage(err, 'No se pudo actualizar la contraseña.');
          }
          this.cdr.markForCheck();
        },
      });
  }

  // ── Cambio de correo ──────────────────────────────────────────────

  activarEditarEmail(): void {
    this.formEmail = this.fb.group({
      nuevoEmail: [
        this.perfil?.email ?? '',
        [Validators.required, Validators.email],
        [this.emailDisponibleValidator()],
      ],
      passwordActual: ['', Validators.required],
    });
    this.modoEditarEmail = true;
    this.estadoEmail     = 'idle';
    this.mensajeEmail    = '';
    this.cdr.markForCheck();
  }

  cancelarEditarEmail(): void {
    this.modoEditarEmail = false;
    this.cdr.markForCheck();
  }

  cambiarEmail(): void {
    this.formEmail.markAllAsTouched();
    if (this.formEmail.invalid) return;

    const { nuevoEmail, passwordActual } = this.formEmail.value;
    if (nuevoEmail.toLowerCase() === this.perfil?.email?.toLowerCase()) {
      this.cancelarEditarEmail();
      return;
    }

    this.estadoEmail  = 'loading';
    this.mensajeEmail = '';
    this.cdr.markForCheck();

    this.usuarioService.actualizarEmail(nuevoEmail, passwordActual)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.estadoEmail  = 'success';
          this.mensajeEmail = 'Correo actualizado. Cerrando sesión...';
          this.cdr.markForCheck();
          timer(UI_TIMINGS.FEEDBACK_SHORT_MS).pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.authService.logout(
              ['/login'],
              { identificadorCambiado: '1', tag: `${this.perfil?.username}#${this.perfil?.tag}` }
            ));
        },
        error: (err) => {
          const body = err?.error;
          if (body?.error === 'Contraseña incorrecta') {
            this.estadoEmail = 'idle';
            this.formEmail.get('passwordActual')?.setErrors({ incorrecta: true });
          } else {
            this.estadoEmail  = 'error';
            this.mensajeEmail = extractHttpErrorMessage(err, 'No se pudo actualizar el correo.');
          }
          this.cdr.markForCheck();
        },
      });
  }

  private emailDisponibleValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const value = (control.value ?? '').trim().toLowerCase();
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return of(null);
      if (this.perfil && value === this.perfil.email.toLowerCase()) return of(null);
      return timer(500).pipe(
        switchMap(() =>
          this.http.get<{ disponible: boolean }>(
            `${this.authApiUrl}/check-email?email=${encodeURIComponent(value)}`
          )
        ),
        map(res => res.disponible ? null : { emailTomado: true }),
        catchError(() => of(null)),
        first(),
        takeUntilDestroyed(this.destroyRef),
      );
    };
  }

  get fNuevoEmail()    { return this.formEmail.get('nuevoEmail')!; }
  get fPasswordEmail() { return this.formEmail.get('passwordActual')!; }

  // ── Avatar ────────────────────────────────────────────────────────

  onAvatarSelected(event: Event): void {
    if (!this.modoEdicion) return;          // solo activo en modo edición
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    // Limpiar input para que (change) se dispare si el usuario vuelve a elegir el mismo archivo
    input.value = '';

    // Revocar objectURL anterior para evitar fugas de memoria
    if (this.avatarPreview) {
      URL.revokeObjectURL(this.avatarPreview);
    }
    const previewUrl    = URL.createObjectURL(file);
    this.avatarPreview  = previewUrl;
    this.subiendoAvatar = true;
    this.avatarError    = '';
    this.cdr.markForCheck();

    this.usuarioService.subirAvatar(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          // Actualizar perfil local con la URL devuelta por el servidor
          if (this.perfil) {
            this.perfil = { ...this.perfil, avatarUrl: res.avatarUrl };
          }
          // Sincronizar token/storage del AuthService
          this.authService.updateUserData({ avatarUrl: res.avatarUrl });

          // Descartar el preview temporal (ahora se carga desde el servidor)
          URL.revokeObjectURL(previewUrl);
          this.avatarPreview  = null;
          this.subiendoAvatar = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          URL.revokeObjectURL(previewUrl);
          this.avatarPreview  = null;
          this.subiendoAvatar = false;
          this.avatarError    = err?.error?.message || 'No se pudo subir la imagen. Máximo 5 MB (JPEG, PNG, GIF, WebP).';
          this.cdr.markForCheck();
        },
      });
  }

  /** URL completa del avatar: preview temporal durante subida, o URL del servidor. */
  getAvatarUrl(): string | null {
    if (this.avatarPreview) return this.avatarPreview;
    const url = this.perfil?.avatarUrl;
    if (!url) return null;
    return `${environment.apiUrl}${url}`;
  }

  /** Iniciales para mostrar cuando no hay avatar. */
  getInitials(): string {
    const n = this.perfil?.nombre?.[0]   ?? '';
    const a = this.perfil?.apellidos?.[0] ?? '';
    const initials = (n + a).toUpperCase();
    if (initials) return initials;
    return this.perfil?.username?.[0]?.toUpperCase() ?? '?';
  }

  hasPendingChanges(): boolean {
    if (this.modoEdicion       && this.formPerfil?.dirty)   return true;
    if (this.modoPasswordAbierto && this.formPassword?.dirty) return true;
    if (this.modoEditarEmail   && this.formEmail?.dirty)    return true;
    return false;
  }
}
