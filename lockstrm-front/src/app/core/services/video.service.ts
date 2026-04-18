import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest, HttpEventType } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
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

  private misVideosCache$:         Observable<Video[]> | null = null;
  private videosCompartidosCache$: Observable<Video[]> | null = null;

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

  /** GET /api/videos/mios — vídeos del usuario autenticado (contexto Propietario). */
  obtenerMisVideos(): Observable<Video[]> {
    if (!this.misVideosCache$) {
      this.misVideosCache$ = this.http.get<VideoRaw[]>(`${this.apiUrl}/mios`).pipe(
        map(arr => arr.map(mapVideo)),
        shareReplay(1),
      );
    }
    return this.misVideosCache$;
  }

  /** GET /api/videos/compartidos — vídeos accesibles vía permisos de grupo (contexto Espectador). */
  obtenerVideosCompartidos(): Observable<Video[]> {
    if (!this.videosCompartidosCache$) {
      this.videosCompartidosCache$ = this.http.get<VideoRaw[]>(`${this.apiUrl}/compartidos`).pipe(
        map(arr => arr.map(mapVideo)),
        shareReplay(1),
      );
    }
    return this.videosCompartidosCache$;
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
    return this.http.request<VideoUploadResponse>(req).pipe(
      tap(event => {
        if (event.type === HttpEventType.Response) {
          this.misVideosCache$ = null;
        }
      }),
    );
  }

  eliminarVideo(idVideo: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${idVideo}`).pipe(
      tap(() => { this.misVideosCache$ = null; }),
    );
  }

  /** PATCH /api/videos/{id} — edita título y/o reasigna el grupo. */
  editarVideo(idVideo: number, titulo: string, idGrupo: number | null): Observable<Video> {
    return this.http.patch<VideoRaw>(`${this.apiUrl}/${idVideo}`, { titulo, idGrupo }).pipe(
      map(raw => mapVideo(raw)),
      tap(() => { this.misVideosCache$ = null; }),
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
