import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { VideoStreamService } from './video-stream.service';

// ── Respuesta del endpoint de subida ──────────────────────────────────────────
export interface VideoUploadResponse {
  id_video: number;
  titulo: string;
  url: string;
  duracion: number;
  status: string;
  mensaje: string;
}

// ── Interfaz canónica del frontend ────────────────────────────────────────────
// El backend puede devolver propietario / nombrePropietario / ownerUsername
// y grupo / nombreGrupo / groupName según el endpoint.
// mapVideo() normaliza cualquier variante al formato único de abajo.
export interface Video {
  idVideo: number;
  titulo: string;
  duracion: number | null;
  urlCloudSecure: string;
  cloudinaryId: string;
  fechaSubida: string | null;
  propietario?: { username: string };
  grupo?: { nombre: string };
}

// Tipo interno que acepta cualquier forma que pueda llegar del backend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VideoRaw = any;

function mapVideo(raw: VideoRaw): Video {
  return {
    idVideo:        raw.idVideo,
    titulo:         raw.titulo,
    duracion:       raw.duracion ?? null,
    urlCloudSecure: raw.urlCloudSecure,
    cloudinaryId:   raw.cloudinaryId ?? '',
    fechaSubida:    raw.fechaSubida ?? raw.uploadDate ?? null,
    propietario:
      raw.propietario
      ?? (raw.nombrePropietario ? { username: raw.nombrePropietario } : undefined)
      ?? (raw.ownerUsername     ? { username: raw.ownerUsername }     : undefined),
    grupo:
      raw.grupo
      ?? (raw.nombreGrupo ? { nombre: raw.nombreGrupo } : undefined)
      ?? (raw.groupName   ? { nombre: raw.groupName }   : undefined),
  };
}

@Injectable({ providedIn: 'root' })
export class VideoService {

  private readonly apiUrl = `${environment.apiUrl}/api/videos`;

  // ── Caché reactiva (shareReplay) ────────────────────────────────────────────
  // Cada caché se invalida (null) cuando el endpoint de escritura asociado
  // completa con éxito, forzando un nuevo GET en la siguiente suscripción.
  private misVideosCache$:         Observable<Video[]> | null = null;
  private videosCompartidosCache$: Observable<Video[]> | null = null;

  constructor(
    private http:          HttpClient,
    private streamService: VideoStreamService,
  ) {}

  // ── URL de streaming ────────────────────────────────────────────────────────

  /** Devuelve la URL segura para el reproductor (vía Service Worker o token en QS). */
  buildStreamUrl(idVideo: number): string {
    return this.streamService.buildUrl(idVideo);
  }

  // ── Lecturas ────────────────────────────────────────────────────────────────

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

  // ── Escrituras (invalidan la caché al completar) ────────────────────────────

  subirVideo(archivo: File, titulo: string, idGrupo?: number | null): Observable<VideoUploadResponse> {
    const formData = new FormData();
    formData.append('file',   archivo);
    formData.append('titulo', titulo);
    if (idGrupo != null) formData.append('idGrupo', idGrupo.toString());
    return this.http.post<VideoUploadResponse>(`${this.apiUrl}/subir`, formData).pipe(
      tap(() => { this.misVideosCache$ = null; }),
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

  /** POST /api/videos/{id}/heartbeat — registra los segundos vistos en tiempo real. */
  registrarHeartbeat(idVideo: number, segundos: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${idVideo}/heartbeat`, { segundos });
  }
}
