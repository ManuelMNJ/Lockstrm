import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { timer } from 'rxjs';
import { UsuarioService } from '../../core/services/usuario.service';
import {
  passwordFortalezaValidator,
  confirmarPasswordValidator,
  calcPwReqs,
} from '../../core/validators/password.validator';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './ajustes.component.html',
  styleUrl: './ajustes.component.css',
})
export class AjustesComponent {

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
          timer(4000)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => { this.estadoPassword = 'idle'; });
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

}
