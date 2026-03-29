import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {

  form: FormGroup;
  cargando     = false;
  errorLogin   = '';
  mensajeInfo  = '';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // Mensaje de confirmación tras registro exitoso
    if (this.route.snapshot.queryParamMap.get('registrado') === '1') {
      this.mensajeInfo = 'Cuenta creada correctamente. Ya puedes iniciar sesión.';
    }
  }

  get email()    { return this.form.get('email')!; }
  get password() { return this.form.get('password')!; }

  hacerLogin(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando   = true;
    this.errorLogin = '';

    this.authService.login(this.email.value, this.password.value).subscribe({
      next:  () => this.router.navigate(['/videos']),
      error: (err) => {
        this.cargando   = false;
        this.errorLogin = err?.error?.error ?? 'Credenciales incorrectas o usuario no encontrado.';
        console.error('[LoginComponent] Error de autenticacion:', err);
      }
    });
  }
}
