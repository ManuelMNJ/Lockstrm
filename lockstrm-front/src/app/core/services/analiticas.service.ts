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

/**
 * Una fila por vídeo del grupo en la pestaña "Analíticas" del detalle.
 * Los agregados están acotados al contexto del grupo (segregación B2B).
 */
export interface GrupoVideoStats {
  idVideo:             number;
  titulo:              string;
  miniaturaUrl:        string | null;
  duracion:            number | null;
  espectadoresUnicos:  number;
  tiempoTotalSegundos: number;
}

export interface VideoLog {
  idLog:          number;
  idUsuario:      number;
  username:       string;
  tag:            string;
  /** ISO-8601 — fecha/hora del registro (inicio de la sesión/día). */
  fechaHora:      string;
  segundosVistos: number | null;
  /**
   * Grupo desde el que se reprodujo el vídeo. null cuando el propietario
   * lo abrió desde "Mis vídeos" (sin contexto de grupo) o el espectador
   * desde "Vídeos compartidos".
   */
  grupoId:        number | null;
  /** Nombre del grupo. null si grupoId es null o si el grupo fue eliminado. */
  grupoNombre:    string | null;
}

@Injectable({ providedIn: 'root' })
export class AnaliticasService {

  private readonly apiUrl = `${environment.apiUrl}/api/analiticas`;

  constructor(private http: HttpClient) {}

  getGlobales(): Observable<AnaliticasGlobales> {
    return this.http.get<AnaliticasGlobales>(`${this.apiUrl}/globales`);
  }

  /**
   * Logs del vídeo para la vista de analíticas. Si se pasa `grupoId`, el
   * backend filtra a las sesiones generadas dentro de ese grupo (analítica
   * contextual); sin él, devuelve todos los logs del vídeo.
   */
  getLogsDelVideo(idVideo: number, grupoId?: number | null): Observable<VideoLog[]> {
    const url = grupoId != null
      ? `${this.apiUrl}/videos/${idVideo}/logs?grupoId=${grupoId}`
      : `${this.apiUrl}/videos/${idVideo}/logs`;
    return this.http.get<VideoLog[]>(url);
  }

  /**
   * Analíticas B2B segregadas por grupo: una fila por vídeo del grupo con
   * espectadores únicos y tiempo total visto, restringido al contexto del
   * propio grupo (las visualizaciones desde otros grupos donde el vídeo
   * también está compartido NO entran). El backend exige rol EDITOR+ en el
   * grupo; si el usuario no lo tiene, responde 403.
   */
  getAnaliticasDelGrupo(idGrupo: number): Observable<GrupoVideoStats[]> {
    return this.http.get<GrupoVideoStats[]>(
      `${environment.apiUrl}/api/grupos/${idGrupo}/analiticas`
    );
  }
}
