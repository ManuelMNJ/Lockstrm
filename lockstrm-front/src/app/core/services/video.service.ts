import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest, HttpEventType } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { VideoStreamService } from './video-stream.service';

export interface VideoVistaEstadistica {
  nombre:   string;
  email:    string;
  contador: number;
}

export interface VideoUploadResponse {
  id_video:     number;
  titulo:       string;
  url:          string;
  duracion:     number;
  status:       string;
  mensaje:      string;
  miniaturaUrl: string | null;
}

export interface Video {
  idVideo:      number;
  titulo:       string;
  duracion:     number | null;
  fechaSubida:  string | null;
  grupo?:       { idGrupo?: number; nombre: string };
  miniaturaUrl: string | null;
}

/** Forma exacta que devuelve VideoDTO del backend. */
interface VideoRaw {
  idVideo:      number;
  titulo:       string;
  duracion:     number | null;
  fechaSubida:  string | null;
  idGrupo:      number | null;
  grupoNombre:  string | null;
  miniaturaUrl: string | null;
}

function mapVideo(raw: VideoRaw): Video {
  return {
    idVideo:      raw.idVideo,
    titulo:       raw.titulo,
    duracion:     raw.duracion ?? null,
    fechaSubida:  raw.fechaSubida ?? null,
    grupo:        (raw.idGrupo != null)
                    ? { idGrupo: raw.idGrupo, nombre: raw.grupoNombre ?? '' }
                    : undefined,
    miniaturaUrl: raw.miniaturaUrl ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class VideoService {

  private readonly apiUrl = `${environment.apiUrl}/api/videos`;

  // null = aún no cargado; [] = cargado sin vídeos; Video[] = datos reales
  private readonly _misVideos$      = new BehaviorSubject<Video[] | null>(null);
  private _misVideosLoaded          = false;
  private _videosCompartidosCache$: Observable<Video[]> | null = null;

  constructor(
    private http:          HttpClient,
    private streamService: VideoStreamService,
  ) {}

  buildStreamUrl(idVideo: number): string {
    return this.streamService.buildUrl(idVideo);
  }

  obtenerVideos(): Observable<Video[]> {
    return this.http.get<VideoRaw[]>(this.apiUrl).pipe(
      map(arr => arr.map(mapVideo)),
    );
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
    return this._misVideos$.pipe(
      filter((v): v is Video[] => v !== null),
    );
  }

  private _fetchMisVideos(): void {
    this.http.get<VideoRaw[]>(`${this.apiUrl}/mios`).pipe(
      map(arr => arr.map(mapVideo)),
    ).subscribe({
      next:  v  => this._misVideos$.next(v),
      error: () => { this._misVideosLoaded = false; },
    });
  }

  /** Inserta un vídeo al principio del sujeto (llamar tras subida exitosa). */
  prependVideo(video: Video): void {
    this._misVideos$.next([video, ...(this._misVideos$.value ?? [])]);
  }

  /** GET /api/videos/compartidos — vídeos accesibles vía permisos de grupo (contexto Espectador). */
  obtenerVideosCompartidos(): Observable<Video[]> {
    if (!this._videosCompartidosCache$) {
      this._videosCompartidosCache$ = this.http.get<VideoRaw[]>(`${this.apiUrl}/compartidos`).pipe(
        map(arr => arr.map(mapVideo)),
        shareReplay(1),
      );
    }
    return this._videosCompartidosCache$;
  }

  subirVideo(archivo: File, titulo: string, idGrupo?: number | null, miniaturaUrl?: string | null): Observable<HttpEvent<VideoUploadResponse>> {
    const formData = new FormData();
    formData.append('file',   archivo);
    formData.append('titulo', titulo);
    if (idGrupo     != null) formData.append('idGrupo',      idGrupo.toString());
    if (miniaturaUrl != null) formData.append('miniaturaUrl', miniaturaUrl);
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

  /** PATCH /api/videos/{id} — edita título y/o reasigna el grupo. */
  editarVideo(idVideo: number, titulo: string, idGrupo: number | null): Observable<Video> {
    return this.http.patch<VideoRaw>(`${this.apiUrl}/${idVideo}`, { titulo, idGrupo }).pipe(
      map(raw => mapVideo(raw)),
      tap(updated => {
        const current = this._misVideos$.value ?? [];
        this._misVideos$.next(current.map(v => v.idVideo === idVideo ? updated : v));
      }),
    );
  }

  registrarHeartbeat(idVideo: number, currentTime: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${idVideo}/heartbeat`, { currentTime: Math.floor(currentTime) });
  }

  registrarVista(idVideo: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${idVideo}/ver`, {});
  }

  obtenerEstadisticas(idVideo: number): Observable<VideoVistaEstadistica[]> {
    return this.http.get<VideoVistaEstadistica[]>(`${this.apiUrl}/${idVideo}/estadisticas`);
  }
}
