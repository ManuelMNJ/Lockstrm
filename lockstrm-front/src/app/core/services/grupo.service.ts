import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
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

  // ── Caché reactiva (shareReplay) ────────────────────────────────────────────
  // Se invalida tras crearGrupo, renombrarGrupo y eliminarGrupo.
  private misGruposCache$: Observable<Grupo[]> | null = null;

  constructor(private http: HttpClient) {}

  // ── Lectura ─────────────────────────────────────────────────────────────────

  obtenerMisGrupos(): Observable<Grupo[]> {
    if (!this.misGruposCache$) {
      this.misGruposCache$ = this.http.get<Grupo[]>(this.apiUrl).pipe(
        shareReplay(1),
      );
    }
    return this.misGruposCache$;
  }

  obtenerMiembros(idGrupo: number): Observable<Miembro[]> {
    return this.http.get<Miembro[]>(`${this.apiUrl}/${idGrupo}/miembros`);
  }

  // ── Escrituras (invalidan la caché al completar) ────────────────────────────

  crearGrupo(nombre: string): Observable<Grupo> {
    return this.http.post<Grupo>(this.apiUrl, { nombre }).pipe(
      tap(() => { this.misGruposCache$ = null; }),
    );
  }

  aniadirMiembro(idGrupo: number, email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${idGrupo}/miembros`, { email });
  }

  eliminarMiembro(idGrupo: number, idUsuario: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idGrupo}/miembros/${idUsuario}`);
  }

  eliminarGrupo(idGrupo: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idGrupo}`).pipe(
      tap(() => { this.misGruposCache$ = null; }),
    );
  }

  renombrarGrupo(idGrupo: number, nombre: string): Observable<Grupo> {
    return this.http.put<Grupo>(`${this.apiUrl}/${idGrupo}`, { nombre }).pipe(
      tap(() => { this.misGruposCache$ = null; }),
    );
  }
}
