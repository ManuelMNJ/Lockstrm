import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard para rutas exclusivamente públicas (/login, /registro).
 * Si el usuario ya tiene sesión activa, lo redirige al dashboard
 * en lugar de mostrarle el formulario de acceso.
 */
export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.isLoggedIn()) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
