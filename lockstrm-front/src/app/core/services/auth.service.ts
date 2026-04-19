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

  private readonly _currentUser = signal<AuthResponse | null>(this.loadFromStorage());

  readonly currentUser     = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(res));
        this._currentUser.set(res);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.clear();
    this._currentUser.set(null);
    this.router.navigate(['/login']).then(() => {
      window.location.reload();
    });
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
    try { return JSON.parse(stored) as AuthResponse; } catch { return null; }
  }
}
