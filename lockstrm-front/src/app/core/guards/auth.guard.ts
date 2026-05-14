import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Guard de área privada. Si no hay sesión activa, redirige a /login
 * preservando la URL solicitada en el query param `returnUrl` para
 * volver a ella tras autenticarse.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.isLoggedIn()) return true;

  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};
