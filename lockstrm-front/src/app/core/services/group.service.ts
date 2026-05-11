import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Group {
  idGrupo: number;
  nombre: string;
  fechaCreacion?: string;
  imagenUrl?: string | null;
}

export interface Member {
  idUsuario: number;
  username: string;
  tag: string;
  rol: string;
  avatarUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class GroupService {

  private readonly apiUrl = `${environment.apiUrl}/api/grupos`;

  private misGruposCache$:       Observable<Group[]> | null = null;
  private gruposCreadosCache$:   Observable<Group[]> | null = null;
  private gruposMiembroCache$:   Observable<Group[]> | null = null;

  constructor(private http: HttpClient) {}

  obtenerMisGrupos(): Observable<Group[]> {
    if (!this.misGruposCache$) {
      this.misGruposCache$ = this.http.get<Group[]>(this.apiUrl).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.misGruposCache$;
  }

  obtenerGruposCreados(): Observable<Group[]> {
    if (!this.gruposCreadosCache$) {
      this.gruposCreadosCache$ = this.http.get<Group[]>(`${this.apiUrl}/creados`).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.gruposCreadosCache$;
  }

  obtenerGruposComoMiembro(): Observable<Group[]> {
    if (!this.gruposMiembroCache$) {
      this.gruposMiembroCache$ = this.http.get<Group[]>(`${this.apiUrl}/miembro`).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.gruposMiembroCache$;
  }

  /** Últimos N grupos en los que el usuario ha reproducido algún vídeo. Sin caché — es dinámica. */
  obtenerGruposRecientes(limit = 3): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/recientes`, {
      params: { limit: limit.toString() },
    });
  }

  obtenerGrupoPorId(idGrupo: number): Observable<Group> {
    return this.http.get<Group>(`${this.apiUrl}/${idGrupo}`);
  }

  obtenerMiembros(idGrupo: number): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.apiUrl}/${idGrupo}/miembros`);
  }

  crearGrupo(nombre: string): Observable<Group> {
    return this.http.post<Group>(this.apiUrl, { nombre }).pipe(
      tap(() => {
        this.misGruposCache$ = null;
        this.gruposCreadosCache$ = null;
        this.gruposMiembroCache$ = null;
      }),
    );
  }

  aniadirMiembro(idGrupo: number, identificador: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${idGrupo}/miembros`, { identificador });
  }

  eliminarMiembro(idGrupo: number, idUsuario: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idGrupo}/miembros/${idUsuario}`);
  }

  cambiarRolMiembro(idGrupo: number, idUsuario: number, rol: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${idGrupo}/miembros/${idUsuario}/rol`, { rol });
  }

  eliminarGrupo(idGrupo: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idGrupo}`).pipe(
      tap(() => {
        this.misGruposCache$ = null;
        this.gruposCreadosCache$ = null;
        this.gruposMiembroCache$ = null;
      }),
    );
  }

  subirImagenGrupo(idGrupo: number, file: File): Observable<{ imagenUrl: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ imagenUrl: string }>(`${this.apiUrl}/${idGrupo}/imagen`, fd).pipe(
      tap(() => {
        this.misGruposCache$ = null;
        this.gruposCreadosCache$ = null;
        this.gruposMiembroCache$ = null;
      }),
    );
  }

  /** Limpia todas las cachés en memoria. Llamar desde AuthService.logout(). */
  clearCaches(): void {
    this.misGruposCache$     = null;
    this.gruposCreadosCache$ = null;
    this.gruposMiembroCache$ = null;
  }

  quitarVideoDelGrupo(idGrupo: number, idVideo: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idGrupo}/videos/${idVideo}`);
  }

  renombrarGrupo(idGrupo: number, nombre: string): Observable<Group> {
    return this.http.patch<Group>(`${this.apiUrl}/${idGrupo}`, { nombre }).pipe(
      tap(() => {
        this.misGruposCache$ = null;
        this.gruposCreadosCache$ = null;
        this.gruposMiembroCache$ = null;
      }),
    );
  }
}
