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
}

@Injectable({ providedIn: 'root' })
export class UserService {

  private readonly apiUrl = `${environment.apiUrl}/api/usuarios`;

  constructor(private http: HttpClient) {}

  obtenerPerfil(): Observable<PerfilUsuario> {
    return this.http.get<PerfilUsuario>(`${this.apiUrl}/perfil`);
  }

  cambiarContrasena(actual: string, nueva: string): Observable<{ mensaje?: string; error?: string }> {
    return this.http.post<{ mensaje?: string; error?: string }>(
      `${this.apiUrl}/cambiar-contrasena`,
      { actual, nueva }
    );
  }
}
