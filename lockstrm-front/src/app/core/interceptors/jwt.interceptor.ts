import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Las rutas de auth son las únicas que no llevan token: login y registro se hacen
  // antes de que el usuario tenga uno, así que no tiene sentido intentar adjuntarlo.
  if (req.url.includes('/api/auth/')) {
    return next(req);
  }

  const token = authService.getToken();

  if (token) {
    // En Angular las peticiones no se pueden modificar directamente una vez creadas,
    // así que usamos .clone() para generar una nueva con la cabecera ya incluida.
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }

  return next(req);
};
