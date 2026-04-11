import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthResponse {
  token: string;
  username: string;
  id: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly apiUrl      = `${environment.apiUrl}/api/auth`;
  private readonly STORAGE_KEY = 'usuarioLogueado';

  // ── Reactive core ────────────────────────────────────────────────────────
  // Signal privado que actúa como fuente de verdad del estado de autenticación.
  // Se inicializa leyendo localStorage al arrancar la app (recarga de página).
  private readonly _currentUser = signal<AuthResponse | null>(this.loadFromStorage());

  /** Señal de sólo lectura con los datos del usuario autenticado (o null). */
  readonly currentUser = this._currentUser.asReadonly();

  /** Computed derivado: true mientras haya un usuario en sesión. */
  readonly isAuthenticated = computed(() => !!this._currentUser());

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  // ── Auth operations ──────────────────────────────────────────────────────

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(res));
        this._currentUser.set(res);   // actualiza el signal → UI reacciona
      })
    );
  }

  /**
   * Destruye la sesión, limpia el signal y redirige a la Homepage pública.
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this._currentUser.set(null);    // signal → null → navbar vuelve a estado guest
    this.router.navigate(['/']);
  }

  // ── Accessors (retrocompatibles con guards e interceptores) ──────────────

  getToken(): string | null {
    return this._currentUser()?.token ?? null;
  }

  getUser(): AuthResponse | null {
    return this._currentUser();
  }

  /** Usado por authGuard y noAuthGuard. Lee del signal, no de localStorage. */
  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private loadFromStorage(): AuthResponse | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;
    try { return JSON.parse(stored) as AuthResponse; } catch { return null; }
  }
}
