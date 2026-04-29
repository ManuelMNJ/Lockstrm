import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PerfilUsuario {
  nombre: string;
  apellidos: string;
  username: string;
  email: string;
  tag: string;
  fechaRegistro: string;
  avatarUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {

  private readonly apiUrl = `${environment.apiUrl}/api/usuarios`;

  constructor(private http: HttpClient) {}

  obtenerPerfil(): Observable<PerfilUsuario> {
    return this.http.get<PerfilUsuario>(`${this.apiUrl}/perfil`);
  }

  actualizarPerfil(data: { nombre: string; apellidos: string; username: string }):
      Observable<{ nombre: string; apellidos: string; username: string; tag: string }> {
    return this.http.put<{ nombre: string; apellidos: string; username: string; tag: string }>(
      `${this.apiUrl}/perfil`, data
    );
  }

  cambiarContrasena(actual: string, nueva: string): Observable<{ mensaje?: string; error?: string }> {
    return this.http.post<{ mensaje?: string; error?: string }>(
      `${this.apiUrl}/cambiar-contrasena`,
      { actual, nueva }
    );
  }

  subirAvatar(file: File): Observable<{ avatarUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ avatarUrl: string }>(`${this.apiUrl}/avatar`, form);
  }

  actualizarEmail(nuevoEmail: string, passwordActual: string): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(
      `${this.apiUrl}/email`, { nuevoEmail, passwordActual }
    );
  }
}
