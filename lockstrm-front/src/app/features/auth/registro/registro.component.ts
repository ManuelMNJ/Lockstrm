import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormGroup, Validators,
  AbstractControl, AsyncValidatorFn, ValidationErrors
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { debounceTime, switchMap, map, catchError, first } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent {

  // Patrón: ≥8 chars, 1 mayúscula, 1 dígito, 1 carácter especial.
  private readonly PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
  private readonly apiUrl           = `${environment.apiUrl}/api/auth`;
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
      password:  ['', [Validators.required, Validators.pattern(this.PASSWORD_PATTERN)]]
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
    const v: string = this.password.value ?? '';
    return {
      length:    v.length >= 8,
      uppercase: /[A-Z]/.test(v),
      number:    /\d/.test(v),
      special:   /[^A-Za-z\d]/.test(v)
    };
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
