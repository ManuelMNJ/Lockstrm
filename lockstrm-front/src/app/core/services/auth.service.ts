import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../constants/storage-keys';

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

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

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
    this.router.navigate(commands, { queryParams }).then(() => {
      window.location.reload();
    });
  }

  updateUserData(data: Partial<AuthResponse>): void {
    const current = this._currentUser();
    if (!current) return;
    const updated = { ...current, ...data };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    this._currentUser.set(updated);
  }

  getToken(): string | null {
    return this._currentUser()?.token ?? null;
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
      return JSON.parse(stored) as AuthResponse;
    } catch (e) {
      console.warn('[AuthService] Sesión corrupta en localStorage, se descarta.', e);
      localStorage.removeItem(this.STORAGE_KEY); // evita que el usuario quede bloqueado
      return null;
    }
  }
}
