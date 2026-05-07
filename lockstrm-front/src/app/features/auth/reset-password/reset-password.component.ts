import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  passwordFortalezaValidator,
  confirmarPasswordValidator,
  calcPwReqs,
} from '../../../core/validators/password.validator';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent implements OnInit {

  private token = '';
  tokenInvalido = false;

  form = inject(FormBuilder).group(
    {
      nuevaContrasena:  ['', [Validators.required, passwordFortalezaValidator()]],
      confirmar:        ['', Validators.required],
    },
    { validators: confirmarPasswordValidator('nuevaContrasena', 'confirmar') }
  );

  estado: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  mensajeError = '';
  showNueva    = false;
  showConfirm  = false;

  private destroyRef  = inject(DestroyRef);
  private authService = inject(AuthService);
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);
  private cdr         = inject(ChangeDetectorRef);

  get ctrlNueva()   { return this.form.get('nuevaContrasena')!; }
  get ctrlConfirm() { return this.form.get('confirmar')!; }
  get pwReqs()      { return calcPwReqs(this.ctrlNueva.value ?? ''); }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) { this.tokenInvalido = true; }
  }

  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.estado = 'loading';
    this.mensajeError = '';
    this.cdr.markForCheck();

    this.authService.resetPassword(this.token, this.ctrlNueva.value!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.router.navigate(['/login'], { queryParams: { passwordReset: '1' } });
        },
        error: (err) => {
          this.estado = 'error';
          this.mensajeError = err?.error?.message ?? 'El enlace es inválido o ha expirado.';
          this.cdr.markForCheck();
        },
      });
  }
}
