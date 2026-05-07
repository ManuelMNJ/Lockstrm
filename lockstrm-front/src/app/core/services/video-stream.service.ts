import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

/**
 * Gestiona el Service Worker proxy para streaming seguro y, como fallback
 * cuando el SW no está disponible, emite tickets de stream de corta duración.
 *
 * Flujo principal (SW activo):
 *   <video src="/video-proxy/{file}"> → SW intercepta → reescribe a backend
 *   real e inyecta cabecera Authorization. El JWT NUNCA aparece en la URL.
 *
 * Fallback (SW no disponible — HTTP local, navegador sin SW, modo incógnito
 * con SW deshabilitado, etc.):
 *   El cliente pide POST /api/videos/stream-ticket/{file} con el JWT
 *   principal en cabecera. El servidor devuelve un ticket firmado, atado
 *   a ese fichero, válido ~60 s. Se usa como ?token={ticket} en el src del
 *   <video>. Si se filtra: solo sirve para ese vídeo y caduca enseguida —
 *   el JWT principal nunca toca la URL.
 */
@Injectable({ providedIn: 'root' })
export class VideoStreamService {

  private swReady = false;

  private readonly authService = inject(AuthService);
  private readonly http        = inject(HttpClient);

  constructor() {
    if ('serviceWorker' in navigator) {
      this.registerSW();
    }

    effect(() => {
      const token = this.authService.currentUser()?.token ?? null;
      this.syncToken(token);
    });
  }

  /**
   * Devuelve la URL que el <video src=...> debe usar. Asíncrona porque la
   * rama de fallback necesita pedir un ticket al backend.
   */
  async buildUrl(fileName: string): Promise<string> {
    if (this.swReady) {
      return `/video-proxy/${encodeURIComponent(fileName)}`;
    }
    const ticket = await this.fetchStreamTicket(fileName);
    return `${environment.apiUrl}/api/videos/stream/${encodeURIComponent(fileName)}?token=${encodeURIComponent(ticket)}`;
  }

  private async fetchStreamTicket(fileName: string): Promise<string> {
    const url = `${environment.apiUrl}/api/videos/stream-ticket/${encodeURIComponent(fileName)}`;
    const resp = await firstValueFrom(
      this.http.post<{ ticket: string; expiresIn: number }>(url, null)
    );
    return resp.ticket;
  }

  private async registerSW(): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.register('/stream-proxy.sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      this.swReady = !!(reg.active ?? navigator.serviceWorker.controller);

      const token = this.authService.getToken();
      this.postMessage({ type: 'LOCKSTRM_INIT', token, apiBase: environment.apiUrl });

    } catch {
      // Registro fallido: buildUrl() usará el fallback con ticket.
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
