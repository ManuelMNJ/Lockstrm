import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface VideoTop {
  idVideo:      number;
  titulo:       string;
  miniaturaUrl: string | null;
  duracion:     number | null;
  vistas:       number;
}

export interface AnaliticasGlobales {
  totalVistas:          number;
  videosSubidos:        number;
  retencionMediaGlobal: number | null;
  topVideos:            VideoTop[];
}

export interface VideoLog {
  idLog:          number;
  idUsuario:      number;
  username:       string;
  tag:            string;
  /** ISO-8601 — fecha/hora del registro (inicio de la sesión/día). */
  fechaHora:      string;
  segundosVistos: number | null;
}

@Injectable({ providedIn: 'root' })
export class AnaliticasService {

  private readonly apiUrl = `${environment.apiUrl}/api/analiticas`;

  constructor(private http: HttpClient) {}

  getGlobales(): Observable<AnaliticasGlobales> {
    return this.http.get<AnaliticasGlobales>(`${this.apiUrl}/globales`);
  }

  getLogsDelVideo(idVideo: number): Observable<VideoLog[]> {
    return this.http.get<VideoLog[]>(`${this.apiUrl}/videos/${idVideo}/logs`);
  }
}
