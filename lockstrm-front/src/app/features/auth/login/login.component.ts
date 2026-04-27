import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {

  form: FormGroup;
  cargando     = false;
  errorLogin   = '';
  mensajeInfo  = '';
  showPassword = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      identificador: ['', [Validators.required]],
      password:      ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Mensaje de confirmación tras registro exitoso
    if (this.route.snapshot.queryParamMap.get('registrado') === '1') {
      this.mensajeInfo = 'Cuenta creada correctamente. Ya puedes iniciar sesión.';
    }
  }

  get identificador() { return this.form.get('identificador')!; }
  get password()      { return this.form.get('password')!; }

  hacerLogin(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando   = true;
    this.errorLogin = '';

    this.authService.login(this.identificador.value, this.password.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  () => this.router.navigate(['/videos']),
        error: (err) => {
          this.cargando   = false;
          this.errorLogin = err?.error?.error ?? 'Credenciales incorrectas o usuario no encontrado.';
          console.warn('[LoginComponent] Error de autenticacion:', err?.status);
        }
      });
  }
}
