import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Grupo {
  idGrupo: number;
  nombre: string;
  fechaCreacion?: string;
}

@Injectable({ providedIn: 'root' })
export class GrupoService {

  private readonly apiUrl = `${environment.apiUrl}/api/grupos`;

  constructor(private http: HttpClient) {}

  obtenerMisGrupos(): Observable<Grupo[]> {
    return this.http.get<Grupo[]>(this.apiUrl);
  }
}
