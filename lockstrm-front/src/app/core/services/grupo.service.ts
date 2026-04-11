import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Grupo {
  idGrupo: number;
  nombre: string;
  fechaCreacion?: string;
}

export interface Miembro {
  idUsuario: number;
  username: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class GrupoService {

  private readonly apiUrl = `${environment.apiUrl}/api/grupos`;

  constructor(private http: HttpClient) {}

  obtenerMisGrupos(): Observable<Grupo[]> {
    return this.http.get<Grupo[]>(this.apiUrl);
  }

  crearGrupo(nombre: string): Observable<Grupo> {
    return this.http.post<Grupo>(this.apiUrl, { nombre });
  }

  aniadirMiembro(idGrupo: number, email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${idGrupo}/miembros`, { email });
  }

  obtenerMiembros(idGrupo: number): Observable<Miembro[]> {
    return this.http.get<Miembro[]>(`${this.apiUrl}/${idGrupo}/miembros`);
  }

  eliminarMiembro(idGrupo: number, idUsuario: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idGrupo}/miembros/${idUsuario}`);
  }

  eliminarGrupo(idGrupo: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idGrupo}`);
  }

  renombrarGrupo(idGrupo: number, nombre: string): Observable<Grupo> {
    return this.http.put<Grupo>(`${this.apiUrl}/${idGrupo}`, { nombre });
  }
}
