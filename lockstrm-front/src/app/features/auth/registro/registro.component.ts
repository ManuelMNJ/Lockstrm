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
import { passwordFortalezaValidator, calcPwReqs } from '../../../core/validators/password.validator';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent {

  private readonly apiUrl = `${environment.apiUrl}/api/auth`;
  private destroyRef                = inject(DestroyRef);

  form: FormGroup;
  cargando     = false;
  errorGlobal  = '';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {
    this.form = this.fb.group({
      nombre:    ['', Validators.required],
      apellidos: ['', Validators.required],
      email:     ['', [Validators.required, Validators.email], [this.emailDisponibleValidator()]],
      password:  ['', [Validators.required, passwordFortalezaValidator()]]
    });
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
  get nombre()    { return this.form.get('nombre')!; }
  get apellidos() { return this.form.get('apellidos')!; }
  get email()     { return this.form.get('email')!; }
  get password()  { return this.form.get('password')!; }

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

    this.http.post(`${this.apiUrl}/registro`, this.form.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cargando = false;
          this.router.navigate(['/login'], { queryParams: { registrado: '1' } });
        },
        error: (err) => {
          this.cargando    = false;
          this.errorGlobal = err?.error?.error ?? 'Error al registrar. Inténtalo de nuevo.';
          console.error('[RegistroComponent] Error:', err);
        }
      });
  }
}
