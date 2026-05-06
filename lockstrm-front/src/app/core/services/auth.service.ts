import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { GroupService } from './group.service';
import { VideoService } from './video.service';

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

  // Inyectados con inject() para evitar dependencia circular en el constructor
  private readonly groupService = inject(GroupService);
  private readonly videoService = inject(VideoService);

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
    // Limpiar cachés de servicios para que no persistan datos entre sesiones
    this.groupService.clearCaches();
    this.videoService.resetCache();
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
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return true; // token malformado → tratar como expirado
    }
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
