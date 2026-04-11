import { Injectable, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/**
 * Gestiona el Service Worker proxy para streaming seguro.
 *
 * En lugar de exponer el JWT en la query string (?token=...) — que queda
 * registrado en los logs del servidor — el servicio:
 *   1. Registra un SW que intercepta peticiones a /video-proxy/{id}
 *   2. El SW reescribe la URL al backend real e inyecta Authorization: Bearer
 *   3. Los componentes obtienen URLs del tipo /video-proxy/{id} (same-origin)
 *
 * Fallback automático si SW no está disponible (entorno sin HTTPS, SSR, etc.):
 * buildUrl() retorna la URL con token en query string.
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

    // Sincroniza el token al SW cada vez que el estado de auth cambia
    // (login, logout, refresco de token).
    effect(() => {
      const token = this.authService.currentUser()?.token ?? null;
      this.syncToken(token);
    });
  }

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * Devuelve la URL de streaming para un vídeo.
   * - Con SW activo: URL same-origin /video-proxy/{id} (JWT en cabecera)
   * - Sin SW:        URL directa con ?token= (fallback, menos seguro)
   */
  buildUrl(idVideo: number): string {
    if (this.swReady) {
      return `/video-proxy/${idVideo}`;
    }
    // Fallback: comportamiento anterior
    const token = this.authService.getToken() ?? '';
    return `${environment.apiUrl}/api/videos/stream/${idVideo}?token=${token}`;
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  private async registerSW(): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.register('/stream-proxy.sw.js', { scope: '/' });

      // Espera a que haya un SW activo y controlando la página
      await navigator.serviceWorker.ready;

      this.swActive = reg.active ?? navigator.serviceWorker.controller;
      this.swReady  = true;

      // Inicializa el SW con el token actual y la base URL del backend
      const token = this.authService.getToken();
      this.postMessage({ type: 'LOCKSTRM_INIT', token, apiBase: environment.apiUrl });

    } catch (err) {
      // SW no disponible (HTTP en producción, CSP restrictiva, etc.) → fallback silencioso
      console.warn('[VideoStream] Service Worker no registrado; usando fallback con token en URL.', err);
    }
  }

  private syncToken(token: string | null): void {
    if (!this.swReady) return;
    this.postMessage({ type: 'LOCKSTRM_SET_TOKEN', token });
  }

  private postMessage(msg: object): void {
    // Envía tanto al controller activo como a través de la registration
    navigator.serviceWorker.controller?.postMessage(msg);
    navigator.serviceWorker.ready
      .then(reg => reg.active?.postMessage(msg))
      .catch(() => { /* silencioso */ });
  }
}
