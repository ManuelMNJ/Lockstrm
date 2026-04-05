import { Injectable } from '@angular/core';
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

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => localStorage.setItem(this.STORAGE_KEY, JSON.stringify(res)))
    );
  }

  getToken(): string | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;
    try { return JSON.parse(stored).token ?? null; } catch { return null; }
  }

  getUser(): AuthResponse | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.router.navigate(['/login']);
  }
}
