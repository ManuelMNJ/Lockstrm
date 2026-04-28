import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { timer } from 'rxjs';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import {
  passwordFortalezaValidator,
  confirmarPasswordValidator,
  calcPwReqs,
} from '../../core/validators/password.validator';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {

  // Formulario reactivo de cambio de contraseña
  formPassword: FormGroup;
  showNuevaPassword = false;

  estadoPassword: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajePassword = '';

  // Dark mode — se inicializa desde localStorage para evitar discrepancias con el DOM
  modoOscuro = localStorage.getItem('lockstrm-theme') !== 'light';

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private usuarioService: UserService,
    private authService: AuthService,
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
        next: () => {
          this.estadoPassword  = 'success';
          this.mensajePassword = 'Contraseña actualizada. Cerrando sesión...';
          this.formPassword.reset();
          timer(2000)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.authService.logout());
        },
        error: (err) => {
          const body = err?.error;
          if (body?.error === 'La contraseña actual no es correcta') {
            this.estadoPassword = 'idle';
            this.ctrlActual.setErrors({ incorrecta: true });
          } else {
            this.estadoPassword  = 'error';
            this.mensajePassword =
              body?.campos?.['nueva'] ||
              body?.message ||
              'No se pudo actualizar la contraseña.';
          }
        },
      });
  }

  // ── Dark mode ───────────────────────────────────────────────────────────────

  toggleModo(): void {
    this.modoOscuro = !this.modoOscuro;
    document.body.classList.toggle('light-mode', !this.modoOscuro);
    localStorage.setItem('lockstrm-theme', this.modoOscuro ? 'dark' : 'light');
  }

}
