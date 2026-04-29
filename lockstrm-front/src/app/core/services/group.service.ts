import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Group {
  idGrupo: number;
  nombre: string;
  fechaCreacion?: string;
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
      this.misGruposCache$ = this.http.get<Group[]>(this.apiUrl).pipe(shareReplay(1));
    }
    return this.misGruposCache$;
  }

  obtenerGruposCreados(): Observable<Group[]> {
    if (!this.gruposCreadosCache$) {
      this.gruposCreadosCache$ = this.http.get<Group[]>(`${this.apiUrl}/creados`).pipe(shareReplay(1));
    }
    return this.gruposCreadosCache$;
  }

  obtenerGruposComoMiembro(): Observable<Group[]> {
    if (!this.gruposMiembroCache$) {
      this.gruposMiembroCache$ = this.http.get<Group[]>(`${this.apiUrl}/miembro`).pipe(shareReplay(1));
    }
    return this.gruposMiembroCache$;
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

  renombrarGrupo(idGrupo: number, nombre: string): Observable<Group> {
    return this.http.put<Group>(`${this.apiUrl}/${idGrupo}`, { nombre }).pipe(
      tap(() => {
        this.misGruposCache$ = null;
        this.gruposCreadosCache$ = null;
        this.gruposMiembroCache$ = null;
      }),
    );
  }
}
