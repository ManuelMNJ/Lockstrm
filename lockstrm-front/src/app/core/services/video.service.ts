import { Injectable, effect, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable, Subject, merge, throwError } from 'rxjs';
import { filter, map, mergeMap, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { VideoStreamService } from './video-stream.service';
import { AuthService } from './auth.service';

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
  idVideo:       number;
  titulo:        string;
  duracion:      number | null;
  fechaSubida:   string | null;
  grupos:        GrupoRef[];
  miniaturaUrl:  string | null;
  fileName:      string | null;
  fileSize:      number | null;
  propietarioId: number | null;
}

/** Forma exacta que devuelve VideoDTO del backend. */
interface VideoRaw {
  idVideo:       number;
  titulo:        string;
  duracion:      number | null;
  fechaSubida:   string | null;
  grupos:        GrupoRef[] | null;
  miniaturaUrl:  string | null;
  fileName:      string | null;
  fileSize:      number | null;
  propietarioId: number | null;
}

function mapVideo(raw: VideoRaw): Video {
  return {
    idVideo:       raw.idVideo,
    titulo:        raw.titulo,
    duracion:      raw.duracion,
    fechaSubida:   raw.fechaSubida,
    grupos:        raw.grupos ?? [],
    miniaturaUrl:  raw.miniaturaUrl,
    fileName:      raw.fileName,
    fileSize:      raw.fileSize ?? null,
    propietarioId: raw.propietarioId ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class VideoService {

  private readonly apiUrl = `${environment.apiUrl}/api/videos`;

  // null = aún no cargado; [] = cargado sin vídeos; Video[] = datos reales
  private readonly _misVideos     = signal<Video[] | null>(null);
  private readonly _misVideosErr$ = new Subject<unknown>();
  private readonly _misVideosObs$ = toObservable(this._misVideos);
  private _misVideosLoaded        = false;

  private readonly authService = inject(AuthService);

  constructor(
    private http:          HttpClient,
    private streamService: VideoStreamService,
  ) {
    // Cuando el usuario cierra sesión (signal → null) limpiamos la caché.
    // allowSignalWrites: true es necesario porque resetCache() escribe en _misVideos.
    effect(() => {
      if (this.authService.currentUser() === null) {
        this.resetCache();
      }
    }, { allowSignalWrites: true });
  }

  buildStreamUrl(fileName: string): Promise<string> {
    return this.streamService.buildUrl(fileName);
  }

  /**
   * Devuelve un Observable vivo derivado del signal de "mis vídeos".
   * Cualquier mutación (subir, borrar, editar) emite aquí automáticamente;
   * todos los componentes suscritos (dashboard, biblioteca) se actualizan sin re-fetch.
   */
  obtenerMisVideos(): Observable<Video[]> {
    if (!this._misVideosLoaded) {
      this._misVideosLoaded = true;
      this._fetchMisVideos();
    }
    return merge(
      this._misVideosObs$.pipe(filter((v): v is Video[] => v !== null)),
      this._misVideosErr$.pipe(mergeMap(err => throwError(() => err))),
    );
  }

  private _fetchMisVideos(): void {
    this.http.get<VideoRaw[]>(`${this.apiUrl}/mios`).pipe(
      map(arr => arr.map(mapVideo)),
    ).subscribe({
      next:  v   => this._misVideos.set(v),
      error: err => {
        this._misVideosLoaded = false;
        this._misVideosErr$.next(err);
      },
    });
  }

  /** Resetea la caché en memoria. Se llama automáticamente al cerrar sesión. */
  resetCache(): void {
    this._misVideos.set(null);
    this._misVideosLoaded = false;
  }

  /** Inserta un vídeo al principio de la lista (llamar tras subida exitosa). */
  prependVideo(video: Video): void {
    this._misVideos.update(current => [video, ...(current ?? [])]);
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
    // La actualización del signal la hace el componente vía prependVideo()
    // porque solo él tiene acceso al nombre del grupo seleccionado.
    return this.http.request<VideoUploadResponse>(req);
  }

  eliminarVideo(idVideo: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idVideo}`).pipe(
      tap(() => this._misVideos.update(v => (v ?? []).filter(x => x.idVideo !== idVideo))),
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
      tap(updated => this._misVideos.update(v => (v ?? []).map(x => x.idVideo === idVideo ? updated : x))),
    );
  }

  actualizarMiniatura(idVideo: number, miniatura: Blob): Observable<string> {
    const fd = new FormData();
    fd.append('miniatura', miniatura, 'thumbnail.jpg');
    return this.http.put<{ miniaturaUrl: string }>(`${this.apiUrl}/${idVideo}/miniatura`, fd).pipe(
      map(res => res.miniaturaUrl),
      tap(url => this._misVideos.update(v => (v ?? []).map(x => x.idVideo === idVideo ? { ...x, miniaturaUrl: url } : x))),
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
