import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest, HttpEventType } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, merge, throwError } from 'rxjs';
import { filter, map, mergeMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { VideoStreamService } from './video-stream.service';

export interface VideoVistaEstadistica {
  username:       string;
  tag:            string;
  contador:       number;
  /** MAX(segundos_vistos) en la tabla logs para este usuario/vídeo. 0 si nunca envió heartbeat. */
  segundosVistos: number;
}

export interface EspacioInfo {
  usedBytes:  number;
  limitBytes: number;
}

export interface VideoUploadResponse {
  id_video:     number;
  titulo:       string;
  fileName:     string;   // nombre UUID del fichero en el servidor (ej. "uuid.mp4")
  duracion:     number;
  status:       string;
  mensaje:      string;
  miniaturaUrl: string | null;
}

export interface GrupoRef {
  idGrupo: number;
  nombre:  string;
}

export interface Video {
  idVideo:      number;
  titulo:       string;
  duracion:     number | null;
  fechaSubida:  string | null;
  /**
   * Lista de grupos a los que pertenece el vídeo (N:M). Vacía si el vídeo
   * no está compartido con ningún grupo (privado).
   */
  grupos:       GrupoRef[];
  miniaturaUrl: string | null;
  fileName:     string | null;  // nombre UUID del fichero; null si el vídeo es antiguo/migrado
}

/** Forma exacta que devuelve VideoDTO del backend. */
interface VideoRaw {
  idVideo:      number;
  titulo:       string;
  duracion:     number | null;
  fechaSubida:  string | null;
  grupos:       GrupoRef[] | null;
  miniaturaUrl: string | null;
  fileName:     string | null;
}

function mapVideo(raw: VideoRaw): Video {
  return {
    idVideo:      raw.idVideo,
    titulo:       raw.titulo,
    duracion:     raw.duracion,
    fechaSubida:  raw.fechaSubida,
    grupos:       raw.grupos ?? [],
    miniaturaUrl: raw.miniaturaUrl,
    fileName:     raw.fileName,
  };
}

@Injectable({ providedIn: 'root' })
export class VideoService {

  private readonly apiUrl = `${environment.apiUrl}/api/videos`;

  // null = aún no cargado; [] = cargado sin vídeos; Video[] = datos reales
  private readonly _misVideos$    = new BehaviorSubject<Video[] | null>(null);
  private readonly _misVideosErr$ = new Subject<unknown>();
  private _misVideosLoaded        = false;

  constructor(
    private http:          HttpClient,
    private streamService: VideoStreamService,
  ) {}

  buildStreamUrl(fileName: string): string {
    return this.streamService.buildUrl(fileName);
  }

  /**
   * Devuelve el BehaviorSubject de "mis vídeos" como Observable vivo.
   * Cualquier mutación (subir, borrar, editar) emite aquí automáticamente;
   * todos los componentes suscritos (dashboard, biblioteca) se actualizan sin re-fetch.
   */
  obtenerMisVideos(): Observable<Video[]> {
    if (!this._misVideosLoaded) {
      this._misVideosLoaded = true;
      this._fetchMisVideos();
    }
    return merge(
      this._misVideos$.pipe(filter((v): v is Video[] => v !== null)),
      this._misVideosErr$.pipe(mergeMap(err => throwError(() => err))),
    );
  }

  private _fetchMisVideos(): void {
    this.http.get<VideoRaw[]>(`${this.apiUrl}/mios`).pipe(
      map(arr => arr.map(mapVideo)),
    ).subscribe({
      next:  v   => this._misVideos$.next(v),
      error: err => {
        this._misVideosLoaded = false;
        this._misVideosErr$.next(err);
      },
    });
  }

  /** Inserta un vídeo al principio del sujeto (llamar tras subida exitosa). */
  prependVideo(video: Video): void {
    this._misVideos$.next([video, ...(this._misVideos$.value ?? [])]);
  }

  /** GET /api/grupos/{idGrupo}/videos — todos los vídeos asignados a un grupo. */
  obtenerVideosPorGrupo(idGrupo: number): Observable<Video[]> {
    return this.http.get<VideoRaw[]>(`${environment.apiUrl}/api/grupos/${idGrupo}/videos`).pipe(
      map(arr => arr.map(mapVideo)),
    );
  }

  subirVideo(archivo: File, titulo: string, idGrupos?: number[] | null, miniatura?: Blob | null, duracion?: number): Observable<HttpEvent<VideoUploadResponse>> {
    const formData = new FormData();
    formData.append('file',   archivo);
    formData.append('titulo', titulo);
    // FormData admite la misma clave repetida; Spring lo bindea a List<Long>.
    (idGrupos ?? []).forEach(id => formData.append('idGrupos', id.toString()));
    // Enviamos la miniatura como fichero JPEG; Spring recibe MultipartFile.
    if (miniatura != null) formData.append('miniatura', miniatura, 'thumbnail.jpg');
    if (duracion  != null && duracion > 0) formData.append('duracion', duracion.toString());
    const req = new HttpRequest('POST', `${this.apiUrl}/subir`, formData, {
      reportProgress: true,
    });
    // La actualización del BehaviorSubject la hace el componente vía prependVideo()
    // porque solo él tiene acceso al nombre del grupo seleccionado.
    return this.http.request<VideoUploadResponse>(req);
  }

  eliminarVideo(idVideo: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idVideo}`).pipe(
      tap(() => {
        const current = this._misVideos$.value ?? [];
        this._misVideos$.next(current.filter(v => v.idVideo !== idVideo));
      }),
    );
  }

  /**
   * PATCH /api/videos/{id} — edita título y/o reasigna grupos.
   * `idGrupos` representa el set FINAL de grupos a los que el vídeo debe
   * pertenecer tras la edición (semántica de "set", no de "add"); el backend
   * calcula el diff. Una lista vacía desvincula el vídeo de todos los grupos.
   */
  editarVideo(idVideo: number, titulo: string, idGrupos: number[]): Observable<Video> {
    return this.http.patch<VideoRaw>(`${this.apiUrl}/${idVideo}`, { titulo, idGrupos }).pipe(
      map(raw => mapVideo(raw)),
      tap(updated => {
        const current = this._misVideos$.value ?? [];
        this._misVideos$.next(current.map(v => v.idVideo === idVideo ? updated : v));
      }),
    );
  }

  obtenerEspacio(): Observable<EspacioInfo> {
    return this.http.get<EspacioInfo>(`${this.apiUrl}/espacio`);
  }

  registrarHeartbeat(
    idVideo:     number,
    currentTime: number,
    sessionId:   string,
    grupoId?:    number | null,
  ): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${idVideo}/heartbeat`, {
      currentTime: Math.floor(currentTime),
      sessionId,
      grupoId: grupoId ?? null,
    });
  }

  registrarVista(idVideo: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${idVideo}/ver`, {});
  }

  /**
   * Estadísticas por usuario del vídeo. Si se pasa `grupoId`, el backend
   * filtra los logs a las sesiones reproducidas dentro de ese grupo
   * (analítica contextual). Sin `grupoId` se devuelven los datos agregados
   * de todas las reproducciones del vídeo.
   */
  obtenerEstadisticas(idVideo: number, grupoId?: number | null): Observable<VideoVistaEstadistica[]> {
    const url = grupoId != null
      ? `${this.apiUrl}/${idVideo}/estadisticas?grupoId=${grupoId}`
      : `${this.apiUrl}/${idVideo}/estadisticas`;
    return this.http.get<VideoVistaEstadistica[]>(url);
  }
}
