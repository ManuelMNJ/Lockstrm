import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsuarioService, PerfilUsuario } from '../../core/services/usuario.service';
import {
  passwordFortalezaValidator,
  confirmarPasswordValidator,
  calcPwReqs,
} from '../../core/validators/password.validator';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.css',
})
export class AjustesComponent implements OnInit {

  perfil: PerfilUsuario | null = null;
  cargandoPerfil = true;

  // Formulario reactivo de cambio de contraseña
  formPassword: FormGroup;
  showNuevaPassword = false;

  estadoPassword: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajePassword = '';

  // Dark mode
  modoOscuro = true;

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private usuarioService: UsuarioService,
  ) {
    this.formPassword = this.fb.group(
      {
        contrasenaActual:  ['', Validators.required],
        contrasenaNueva:   ['', [Validators.required, passwordFortalezaValidator()]],
        contrasenaConfirm: ['', Validators.required],
      },
      { validators: confirmarPasswordValidator('contrasenaNueva', 'contrasenaConfirm') },
    );
  }

  ngOnInit(): void {
    this.modoOscuro = !document.body.classList.contains('light-mode');

    this.usuarioService.obtenerPerfil()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  (p) => { this.perfil = p; this.cargandoPerfil = false; },
        error: ()  => { this.cargandoPerfil = false; },
      });
  }

  // ── Shortcuts de controles ──────────────────────────────────────────────────

  get ctrlActual()  { return this.formPassword.get('contrasenaActual')!;  }
  get ctrlNueva()   { return this.formPassword.get('contrasenaNueva')!;   }
  get ctrlConfirm() { return this.formPassword.get('contrasenaConfirm')!; }

  /** Requisitos de fortaleza en tiempo real para la checklist del template. */
  get pwReqsNueva() {
    return calcPwReqs(this.ctrlNueva.value ?? '');
  }

  // ── Cambio de contraseña ────────────────────────────────────────────────────

  cambiarContrasena(): void {
    this.formPassword.markAllAsTouched();
    if (this.formPassword.invalid) return;

    const { contrasenaActual, contrasenaNueva } = this.formPassword.value;
    this.estadoPassword  = 'loading';
    this.mensajePassword = '';

    this.usuarioService.cambiarContrasena(contrasenaActual, contrasenaNueva)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.estadoPassword  = 'success';
          this.mensajePassword = res.mensaje ?? 'Contraseña actualizada correctamente.';
          this.formPassword.reset();
          setTimeout(() => { this.estadoPassword = 'idle'; }, 4000);
        },
        error: (err) => {
          this.estadoPassword  = 'error';
          this.mensajePassword = err?.error?.error || 'No se pudo actualizar la contraseña.';
        },
      });
  }

  // ── Dark mode ───────────────────────────────────────────────────────────────

  toggleModo(): void {
    this.modoOscuro = !this.modoOscuro;
    document.body.classList.toggle('light-mode', !this.modoOscuro);
    localStorage.setItem('lockstrm-theme', this.modoOscuro ? 'dark' : 'light');
  }

  // ── Helpers de presentación ─────────────────────────────────────────────────

  formatearFecha(fecha: string | undefined): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  rolLegible(rol: string | undefined): string {
    if (!rol) return '—';
    return rol === 'SUPER_ADMIN' ? 'Administrador' : 'Miembro';
  }
}
