import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Video } from './video.service';

export interface Grupo {
  idGrupo: number;
  nombre: string;
  fechaCreacion?: string;
  idCreador?: number;
}

export interface Miembro {
  idUsuario: number;
  username: string;
  email: string;
}

export interface GrupoStats {
  idGrupo: number;
  nombre: string;
  idCreador: number;
  totalMiembros: number;
}

@Injectable({ providedIn: 'root' })
export class GrupoService {

  private readonly apiUrl = `${environment.apiUrl}/api/grupos`;

  // ── Caché reactiva (shareReplay) ────────────────────────────────────────────
  // Se invalida tras crearGrupo, renombrarGrupo y eliminarGrupo.
  private misGruposCache$: Observable<Grupo[]> | null = null;

  constructor(private http: HttpClient) {}

  // ── Lectura ─────────────────────────────────────────────────────────────────

  obtenerGrupoStats(): Observable<GrupoStats[]> {
    return this.http.get<GrupoStats[]>(`${this.apiUrl}/stats`);
  }

  obtenerMisGrupos(): Observable<Grupo[]> {
    if (!this.misGruposCache$) {
      this.misGruposCache$ = this.http.get<Grupo[]>(this.apiUrl).pipe(
        shareReplay(1),
      );
    }
    return this.misGruposCache$;
  }

  obtenerGrupoPorId(idGrupo: number): Observable<Grupo> {
    return this.http.get<Grupo>(`${this.apiUrl}/${idGrupo}`);
  }

  obtenerMiembros(idGrupo: number): Observable<Miembro[]> {
    return this.http.get<Miembro[]>(`${this.apiUrl}/${idGrupo}/miembros`);
  }

  obtenerVideosDeGrupo(idGrupo: number): Observable<Video[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${idGrupo}/videos`).pipe(
      map(arr => arr.map(raw => ({
        idVideo:     raw.idVideo,
        titulo:      raw.titulo,
        duracion:    raw.duracion ?? null,
        fechaSubida: raw.fechaSubida ?? null,
        grupo:       (raw.idGrupo != null)
                       ? { idGrupo: raw.idGrupo, nombre: raw.grupoNombre ?? '' }
                       : undefined,
      } as Video))),
    );
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
