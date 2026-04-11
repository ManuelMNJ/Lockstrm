import { ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { VideoService, Video } from '../../core/services/video.service';
import { AuthService } from '../../core/services/auth.service';
import { GrupoService, Grupo } from '../../core/services/grupo.service';
import { environment } from '../../../environments/environment';
import { VideoPlayerComponent } from './video-player/video-player.component';

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [CommonModule, FormsModule, VideoPlayerComponent],
  templateUrl: './videos.component.html',
  styleUrl: './videos.component.css'
})
export class VideosComponent implements OnInit {

  videos: Video[] = [];
  misGrupos: Grupo[] = [];
  archivoSeleccionado: File | null = null;
  tituloVideo = '';
  idGrupoSeleccionado: number | null = null;

  estadoSubida: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
  mensajeError = '';
  listaError   = '';

  deletingIds = new Set<number>();

  videoAEliminar: Video | null = null;
  videoReproduciendose: Video | null = null;

  @ViewChild('archivoInput') archivoInput!: ElementRef<HTMLInputElement>;

  // Forzamos la detección de cambios manualmente porque al subir archivos grandes
  // Angular pierde el rastro de la asincronía y la UI no se actualiza sola.
  private cdr       = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  constructor(
    private videoService: VideoService,
    private authService: AuthService,
    private grupoService: GrupoService
  ) {}

  ngOnInit(): void {
    this.cargarVideos();
    this.grupoService.obtenerMisGrupos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupos) => {
          this.misGrupos = grupos;
          this.cdr.detectChanges();
        },
        error: (err) => console.error('[VideosComponent] Error al cargar grupos:', err)
      });
  }

  seleccionarArchivo(event: Event): void {
    this.archivoSeleccionado = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  subir(): void {
    if (!this.archivoSeleccionado || !this.tituloVideo) {
      this.estadoSubida = 'error';
      this.mensajeError = 'Falta el titulo o el video.';
      return;
    }

    // 95 MB y no 100 para dejar margen: el contenedor multipart añade algo de peso extra
    // y Cloudinary nos corta la subida si llegamos justo al límite.
    const LIMITE_MB    = 95;
    const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;

    if (this.archivoSeleccionado.size > LIMITE_BYTES) {
      this.estadoSubida = 'error';
      this.mensajeError = `El video supera el limite de ${LIMITE_MB} MB.`;
      return;
    }

    this.estadoSubida = 'uploading';
    this.mensajeError = '';

    this.videoService.subirVideo(this.archivoSeleccionado, this.tituloVideo, this.idGrupoSeleccionado)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        // Safety net: libera el bloqueo si el observable termina sin pasar por
        // next/error (e.g. componente destruido a mitad de la subida).
        finalize(() => {
          if (this.estadoSubida === 'uploading') {
            this.estadoSubida = 'idle';
          }
        })
      )
      .subscribe({
        next: (res) => {
          // Optimistic UI: insertar el nuevo vídeo al inicio sin GET al servidor.
          const grupo = this.idGrupoSeleccionado
            ? (this.misGrupos.find(g => g.idGrupo === this.idGrupoSeleccionado) ?? null)
            : null;

          const nuevoVideo: Video = {
            idVideo:        res.id_video,
            titulo:         res.titulo,
            duracion:       res.duracion ?? null,
            urlCloudSecure: res.url,
            cloudinaryId:   '',
            fechaSubida:    new Date().toISOString(),
            grupo:          grupo ? { nombre: grupo.nombre } : undefined,
          };

          this.videos              = [nuevoVideo, ...this.videos];
          this.estadoSubida        = 'success';
          this.tituloVideo         = '';
          this.archivoSeleccionado = null;
          this.idGrupoSeleccionado = null;
          this.archivoInput.nativeElement.value = '';
          this.cdr.detectChanges();

          setTimeout(() => {
            this.estadoSubida = 'idle';
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          this.estadoSubida = 'error';
          this.mensajeError = err?.error?.mensaje || err?.error?.error || 'Error al subir. Comprueba la consola.';
          console.error('[VideosComponent] Error en subida:', {
            status:     err?.status,
            statusText: err?.statusText,
            body:       err?.error,
          });
          this.cdr.detectChanges();
        }
      });
  }

  solicitarEliminacion(video: Video): void {
    this.videoAEliminar = video;
    this.cdr.detectChanges();
  }

  cancelarEliminacion(): void {
    this.videoAEliminar = null;
    this.cdr.detectChanges();
  }

  confirmarEliminacion(): void {
    const video = this.videoAEliminar;
    if (!video) return;

    this.videoAEliminar = null;
    this.deletingIds = new Set(this.deletingIds).add(video.idVideo);
    this.cdr.detectChanges();

    this.videoService.eliminarVideo(video.idVideo)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.deletingIds = new Set(this.deletingIds);
          this.deletingIds.delete(video.idVideo);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          // Optimistic UI: eliminar en memoria sin GET al servidor.
          this.videos = this.videos.filter(v => v.idVideo !== video.idVideo);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('[VideosComponent] Error al eliminar vídeo:', {
            status:     err?.status,
            statusText: err?.statusText,
            body:       err?.error,
          });
          this.cdr.detectChanges();
        }
      });
  }

  cargarVideos(): void {
    this.listaError = '';
    this.videoService.obtenerMisVideos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => {
          this.videos = datos;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.listaError = `No se pudo cargar la biblioteca (${err?.status ?? 'sin conexion'}). Recarga la pagina.`;
          console.error('[VideosComponent] Error al cargar videos:', err);
          this.cdr.detectChanges();
        }
      });
  }

  abrirReproductor(video: Video): void {
    this.videoReproduciendose = video;
    this.cdr.detectChanges();
  }

  cerrarReproductor(): void {
    this.videoReproduciendose = null;
    this.cdr.detectChanges();
  }

  construirUrlStreaming(idVideo: number): string {
    const token = this.authService.getToken() ?? '';
    return `${environment.apiUrl}/api/videos/stream/${idVideo}?token=${token}`;
  }

  formatearDuracion(segundos: number | null | undefined): string {
    if (segundos == null || segundos <= 0) return '—';
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Receives heartbeat events from VideoPlayerComponent.
   * currentTime is the playback position in seconds at the moment of the ping.
   * Extend this method to POST the event to a backend audit endpoint.
   */
  onHeartbeat(currentTime: number): void {
    console.log(`[Heartbeat] videoId=${this.videoReproduciendose?.idVideo} t=${Math.floor(currentTime)}s`);
  }
}
