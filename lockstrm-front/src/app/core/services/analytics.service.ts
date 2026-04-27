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

export interface GlobalAnalytics {
  totalVistas:          number;
  videosSubidos:        number;
  retencionMediaGlobal: number | null;
  topVideos:            VideoTop[];
}

/**
 * Una fila por vídeo del grupo en la pestaña "Analíticas" del detalle.
 * Todos los agregados están acotados al contexto del grupo (segregación B2B)
 * y se calculan sobre sesiones independientes — cada apertura del
 * reproductor es una fila en `logs`, no se colapsan por usuario.
 */
export interface GroupVideoStats {
  idVideo:                   number;
  titulo:                    string;
  miniaturaUrl:              string | null;
  duracion:                  number | null;
  /** Subidor del vídeo. La columna "Subido por" solo se pinta para ADMIN+. */
  autorIdUsuario:            number;
  autorUsername:             string;
  autorTag:                  string;
  /** Aperturas del reproductor (sesiones), no usuarios distintos. */
  visitasTotales:            number;
  /** Usuarios distintos que han generado al menos una sesión. */
  espectadoresUnicos:        number;
  /** Suma cruda de segundos vistos. Métrica secundaria de "consumo agregado". */
  tiempoTotalSegundos:       number;
  /** AVG por sesión — atención típica en una visita. */
  duracionMediaSegundos:     number;
  /** AVG por sesión del % completado, capado a 100. */
  porcentajeCompletadoMedio: number;
  /** ISO-8601, o null si nunca se ha visto. */
  ultimaVisita:              string | null;
  /**
   * Visitas/día de los últimos 30 días, alineadas al calendario.
   * `sparkline[0]` = hace 29 días, `sparkline[29]` = hoy.
   * Independiente del filtro de fechas (siempre 30 d) para dar contexto fijo.
   */
  sparkline:                 number[];
}

/**
 * Rango opcional pasado a las llamadas de analíticas. Strings ISO-8601 que
 * el backend deserializa con @DateTimeFormat. null = "sin límite por ese
 * extremo" (todos los valores).
 */
export interface DateRange {
  desde?: string | null;
  hasta?: string | null;
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
   * Group desde el que se reprodujo el vídeo. null cuando el propietario
   * lo abrió desde "Mis vídeos" (sin contexto de grupo) o el espectador
   * desde "Vídeos compartidos".
   */
  grupoId:        number | null;
  /** Nombre del grupo. null si grupoId es null o si el grupo fue eliminado. */
  grupoNombre:    string | null;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  private readonly apiUrl = `${environment.apiUrl}/api/analiticas`;

  constructor(private http: HttpClient) {}

  getGlobales(): Observable<GlobalAnalytics> {
    return this.http.get<GlobalAnalytics>(`${this.apiUrl}/globales`);
  }

  /**
   * Logs del vídeo para la vista de analíticas. Si se pasa `grupoId`, el
   * backend filtra a las sesiones generadas dentro de ese grupo (analítica
   * contextual); sin él, devuelve todos los logs del vídeo.
   */
  getLogsDelVideo(idVideo: number, grupoId?: number | null,
                  rango?: DateRange): Observable<VideoLog[]> {
    const params = this.buildParams({ grupoId, ...rango });
    return this.http.get<VideoLog[]>(`${this.apiUrl}/videos/${idVideo}/logs`, { params });
  }

  /**
   * Construye los query params descartando valores null/undefined. HttpParams
   * solo acepta string|number|boolean, así que normalizamos antes.
   */
  private buildParams(obj: Record<string, string | number | null | undefined>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v != null && v !== '') out[k] = String(v);
    }
    return out;
  }

  /**
   * Analíticas B2B segregadas por grupo: una fila por vídeo del grupo con
   * espectadores únicos y tiempo total visto, restringido al contexto del
   * propio grupo (las visualizaciones desde otros grupos donde el vídeo
   * también está compartido NO entran). El backend exige rol EDITOR+ en el
   * grupo; si el usuario no lo tiene, responde 403.
   */
  getAnaliticasDelGrupo(idGrupo: number, rango?: DateRange): Observable<GroupVideoStats[]> {
    const params = this.buildParams({ ...rango });
    return this.http.get<GroupVideoStats[]>(
      `${environment.apiUrl}/api/grupos/${idGrupo}/analiticas`,
      { params }
    );
  }
}
