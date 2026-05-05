import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ReactiveFormsModule, FormBuilder, FormGroup, Validators,
  AbstractControl, AsyncValidatorFn, ValidationErrors
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { debounceTime, switchMap, map, catchError, first } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { passwordFortalezaValidator, confirmarPasswordValidator, calcPwReqs } from '../../../core/validators/password.validator';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {

  private readonly apiUrl = `${environment.apiUrl}/api/auth`;
  private destroyRef                = inject(DestroyRef);

  form: FormGroup;
  cargando             = false;
  errorGlobal          = '';
  showPassword         = false;
  showPasswordConfirm  = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {
    this.form = this.fb.group({
      nombre:          ['', Validators.required],
      apellidos:       ['', Validators.required],
      username:        ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
        Validators.pattern(/^[A-Za-z0-9_-]+$/)
      ], [this.usernameDisponibleValidator()]],
      email:           ['', [Validators.required, Validators.email], [this.emailDisponibleValidator()]],
      password:        ['', [Validators.required, passwordFortalezaValidator()]],
      passwordConfirm: ['', Validators.required],
    }, { validators: confirmarPasswordValidator('password', 'passwordConfirm') });
  }

  // Validador asíncrono: comprueba si quedan tags libres para este username.
  private usernameDisponibleValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const value = (control.value ?? '').trim();
      if (!value || !/^[A-Za-z0-9_-]{3,20}$/.test(value)) return of(null);
      return of(value).pipe(
        debounceTime(500),
        switchMap(username =>
          this.http.get<{ disponible: boolean }>(
            `${this.apiUrl}/check-username?username=${encodeURIComponent(username)}`
          )
        ),
        map(res => res.disponible ? null : { usernameSaturado: true }),
        catchError(() => of(null)),
        first(),
        takeUntilDestroyed(this.destroyRef)
      );
    };
  }

  // Validador asíncrono: comprueba en el backend si el email ya está registrado.
  // Solo lanza la petición si el formato ya es válido; usa debounce de 500 ms.
  private emailDisponibleValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const value = (control.value ?? '').trim();
      if (!value || !/.+@.+\..+/.test(value)) return of(null);
      return of(value).pipe(
        debounceTime(500),
        switchMap(email =>
          this.http.get<{ disponible: boolean }>(
            `${this.apiUrl}/check-email?email=${encodeURIComponent(email)}`
          )
        ),
        map(res => res.disponible ? null : { emailTomado: true }),
        catchError(() => of(null)),
        first(),
        takeUntilDestroyed(this.destroyRef)
      );
    };
  }

  // Atajos para el template
  get nombre()          { return this.form.get('nombre')!; }
  get apellidos()       { return this.form.get('apellidos')!; }
  get username()        { return this.form.get('username')!; }
  get email()           { return this.form.get('email')!; }
  get password()        { return this.form.get('password')!; }
  get passwordConfirm() { return this.form.get('passwordConfirm')!; }

  // Evalúa cada requisito de la contraseña en tiempo real contra el valor actual.
  get pwReqs() {
    return calcPwReqs(this.password.value ?? '');
  }

  registrar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando    = true;
    this.errorGlobal = '';

    this.http.post<{ displayTag?: string }>(`${this.apiUrl}/registro`, this.form.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.cargando = false;
          const params: Record<string, string> = { registrado: '1' };
          if (res?.displayTag) params['tag'] = res.displayTag;
          this.router.navigate(['/login'], { queryParams: params });
        },
        error: (err) => {
          this.cargando    = false;
          this.errorGlobal = err?.error?.error ?? 'Error al registrar. Inténtalo de nuevo.';
        }
      });
  }
}
