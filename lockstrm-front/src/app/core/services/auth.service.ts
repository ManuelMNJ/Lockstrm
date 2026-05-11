import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { GroupService } from './group.service';

export interface AuthResponse {
  token: string;
  username: string;
  tag: string;
  nombre: string;
  apellidos: string;
  id: number;
  avatarUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly apiUrl      = `${environment.apiUrl}/api/auth`;
  private readonly STORAGE_KEY = STORAGE_KEYS.user;

  private readonly _currentUser = signal<AuthResponse | null>(this.loadFromStorage());

  readonly currentUser     = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());

  private readonly groupService = inject(GroupService);

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  forgotPassword(email: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, nuevaContrasena: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.apiUrl}/reset-password`, { token, nuevaContrasena });
  }

  login(identificador: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { identificador, password }).pipe(
      tap(res => {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(res));
        this._currentUser.set(res);
      })
    );
  }

  logout(commands: string[] = ['/login'], queryParams?: Record<string, string>): void {
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.clear();
    this._currentUser.set(null);
    // Limpiar cachés de servicios para que no persistan datos entre sesiones
    this.groupService.clearCaches();
    // VideoService se auto-resetea vía effect() en su propio constructor
    this.router.navigate(commands, { queryParams });
  }

  updateUserData(data: Partial<AuthResponse>): void {
    const current = this._currentUser();
    if (!current) return;
    const updated = { ...current, ...data };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    this._currentUser.set(updated);
  }

  getToken(): string | null {
    const token = this._currentUser()?.token ?? null;
    if (token && this.isTokenExpired(token)) {
      // Token expirado: limpiar sesión para que el guard redirija a login
      localStorage.removeItem(this.STORAGE_KEY);
      this._currentUser.set(null);
      return null;
    }
    return token;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeJwtPayload(token);
      return typeof payload['exp'] === 'number' && payload['exp'] * 1000 < Date.now();
    } catch {
      return true; // token malformado → tratar como expirado
    }
  }

  /**
   * Decodifica el payload de un JWT. Convierte base64url → base64 estándar
   * antes de llamar a atob(), ya que JWT usa base64url (sin padding, con - y _).
   */
  private decodeJwtPayload(token: string): Record<string, unknown> {
    const part = token.split('.')[1] ?? '';
    const b64  = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad  = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    return JSON.parse(atob(b64 + pad));
  }

  getUser(): AuthResponse | null {
    return this._currentUser();
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  private loadFromStorage(): AuthResponse | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;
    try {
      const user = JSON.parse(stored) as AuthResponse;
      if (this.isTokenExpired(user.token)) {
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }
      return user;
    } catch (e) {
      console.warn('[AuthService] Sesión corrupta en localStorage, se descarta.', e);
      localStorage.removeItem(this.STORAGE_KEY);
      return null;
    }
  }
}
