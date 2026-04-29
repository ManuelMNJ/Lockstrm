import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormGroup, Validators,
  AbstractControl, AsyncValidatorFn, ValidationErrors
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { debounceTime, switchMap, map, catchError, first, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { UserService, PerfilUsuario } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { DateLocalePipe } from '../../shared/pipes/date-locale.pipe';
import {
  passwordFortalezaValidator,
  confirmarPasswordValidator,
  calcPwReqs,
} from '../../core/validators/password.validator';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DateLocalePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {

  perfil: PerfilUsuario | null = null;
  cargando = true;
  error    = '';

  // ── Edición de perfil ─────────────────────────────────────────────
  modoEdicion  = false;
  formPerfil!: FormGroup;
  estadoPerfil: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajePerfil = '';

  // ── Cambio de contraseña ──────────────────────────────────────────
  formPassword!: FormGroup;
  showNuevaPassword   = false;
  showConfirmPassword = false;
  estadoPassword: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajePassword = '';

  // ── Avatar ────────────────────────────────────────────────────────
  avatarPreview: string | null = null;  // objectURL temporal durante la subida
  subiendoAvatar = false;
  avatarError    = '';

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
    this.modoEdicion = false;
  }

  guardarPerfil(): void {
    if (this.formPerfil.invalid) { this.formPerfil.markAllAsTouched(); return; }

    const originalUsername = this.perfil?.username ?? '';
    this.estadoPerfil = 'loading';

    this.usuarioService.actualizarPerfil(this.formPerfil.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizado) => {
          const usernameChanged = actualizado.username.toLowerCase() !== originalUsername.toLowerCase();
          this.perfil      = { ...this.perfil!, ...actualizado };
          this.modoEdicion = false;
          this.cdr.markForCheck();

          if (usernameChanged) {
            this.estadoPerfil  = 'success';
            this.mensajePerfil = 'Nombre de usuario actualizado. Cerrando sesión...';
            this.cdr.markForCheck();
            timer(2000).pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe(() => this.authService.logout(
                ['/login'],
                { identificadorCambiado: '1', tag: `${actualizado.username}#${actualizado.tag}` }
              ));
          } else {
            this.authService.updateUserData(actualizado);
            this.estadoPerfil  = 'success';
            this.mensajePerfil = 'Perfil actualizado correctamente.';
            this.cdr.markForCheck();
            timer(3000).pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe(() => { this.estadoPerfil = 'idle'; this.cdr.markForCheck(); });
          }
        },
        error: (err) => {
          this.estadoPerfil  = 'error';
          this.mensajePerfil = err?.error?.message || 'No se pudo actualizar el perfil.';
          this.cdr.markForCheck();
        },
      });
  }

  private usernameDisponibleValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const value = (control.value ?? '').trim();
      if (!value || !/^[A-Za-z0-9_-]{3,20}$/.test(value)) return of(null);
      if (this.perfil && value.toLowerCase() === this.perfil.username.toLowerCase()) return of(null);
      return of(value).pipe(
        debounceTime(500),
        switchMap(username =>
          this.http.get<{ disponible: boolean }>(
            `${this.authApiUrl}/check-username?username=${encodeURIComponent(username)}`
          )
        ),
        map(res => res.disponible ? null : { usernameSaturado: true }),
        catchError(() => of(null)),
        first(),
        takeUntilDestroyed(this.destroyRef),
      );
    };
  }

  get fNombre()    { return this.formPerfil.get('nombre')!; }
  get fApellidos() { return this.formPerfil.get('apellidos')!; }
  get fUsername()  { return this.formPerfil.get('username')!; }

  // ── Cambio de contraseña ──────────────────────────────────────────

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
          timer(2000).pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.authService.logout());
        },
        error: (err) => {
          const body = err?.error;
          if (body?.error === 'La contraseña actual no es correcta') {
            this.estadoPassword = 'idle';
            this.ctrlActual.setErrors({ incorrecta: true });
          } else {
            this.estadoPassword  = 'error';
            this.mensajePassword = body?.campos?.['nueva'] || body?.message || 'No se pudo actualizar la contraseña.';
          }
          this.cdr.markForCheck();
        },
      });
  }

  // ── Avatar ────────────────────────────────────────────────────────

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    // Limpiar input para que (change) se dispare si el usuario vuelve a elegir el mismo archivo
    input.value = '';

    // Revocar objectURL anterior para evitar fugas de memoria
    if (this.avatarPreview) {
      URL.revokeObjectURL(this.avatarPreview);
    }
    this.avatarPreview  = URL.createObjectURL(file);
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
          URL.revokeObjectURL(this.avatarPreview!);
          this.avatarPreview  = null;
          this.subiendoAvatar = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          URL.revokeObjectURL(this.avatarPreview!);
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
}
