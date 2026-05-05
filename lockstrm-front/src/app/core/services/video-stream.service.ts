import { Injectable, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/**
 * Gestiona el Service Worker proxy para streaming seguro.
 *
 * El SW intercepta peticiones a /video-proxy/{fileName}, reescribe la URL
 * al backend e inyecta Authorization: Bearer sin exponer el token en la URL.
 *
 * Fallback automático si SW no está disponible (HTTP, SSR, etc.):
 * buildUrl() devuelve la URL con ?token= en query string, que el filtro
 * JwtAuthenticationFilter acepta exclusivamente en rutas /stream/.
 */
@Injectable({ providedIn: 'root' })
export class VideoStreamService {

  private swActive: ServiceWorker | null = null;
  private swReady  = false;

  private readonly authService = inject(AuthService);

  constructor() {
    if ('serviceWorker' in navigator) {
      this.registerSW();
    }

    effect(() => {
      const token = this.authService.currentUser()?.token ?? null;
      this.syncToken(token);
    });
  }

  buildUrl(fileName: string): string {
    if (this.swReady) {
      return `/video-proxy/${encodeURIComponent(fileName)}`;
    }
    const token = this.authService.getToken() ?? '';
    return `${environment.apiUrl}/api/videos/stream/${encodeURIComponent(fileName)}?token=${token}`;
  }

  private async registerSW(): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.register('/stream-proxy.sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      this.swActive = reg.active ?? navigator.serviceWorker.controller;
      this.swReady  = true;

      const token = this.authService.getToken();
      this.postMessage({ type: 'LOCKSTRM_INIT', token, apiBase: environment.apiUrl });

    } catch {
      // Registro fallido (HTTP local, contexto sin SW): buildUrl() usará el fallback con token en URL.
    }
  }

  private syncToken(token: string | null): void {
    if (!this.swReady) return;
    this.postMessage({ type: 'LOCKSTRM_SET_TOKEN', token });
  }

  private postMessage(msg: object): void {
    navigator.serviceWorker.controller?.postMessage(msg);
    navigator.serviceWorker.ready
      .then(reg => reg.active?.postMessage(msg))
      .catch(() => { /* silencioso */ });
  }
}
