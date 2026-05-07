import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {

  form = inject(FormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });

  estado: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajeError = '';

  private destroyRef  = inject(DestroyRef);
  private authService = inject(AuthService);
  private cdr         = inject(ChangeDetectorRef);

  get email() { return this.form.get('email')!; }

  enviar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.estado = 'loading';
    this.mensajeError = '';
    this.cdr.markForCheck();

    this.authService.forgotPassword(this.email.value!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.estado = 'success';
          this.cdr.markForCheck();
        },
        error: () => {
          this.estado = 'error';
          this.mensajeError = 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }
}
