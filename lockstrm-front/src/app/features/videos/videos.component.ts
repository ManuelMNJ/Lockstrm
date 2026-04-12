import { ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { VideoService, Video } from '../../core/services/video.service';
import { GrupoService, Grupo } from '../../core/services/grupo.service';
import { VideoPlayerComponent } from './video-player/video-player.component';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, VideoPlayerComponent, VideoDurationPipe],
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

  errorEliminacion = '';
  errorEliminacionVisible = false;
  private errorEliminacionTimer: ReturnType<typeof setTimeout> | null = null;

  videoAEliminar: Video | null = null;
  videoReproduciendose: Video | null = null;

  // ── Edición de vídeo ───────────────────────────────────────────────────────
  videoEnEdicion: Video | null = null;
  editTitulo    = '';
  editIdGrupo: number | null = null;
  estadoEdicion: 'idle' | 'saving' | 'error' = 'idle';
  mensajeEdicion = '';

  // ── Paginación ─────────────────────────────────────────────────────────────
  readonly PAGE_SIZE = 15;
  currentPage = 1;

  get paginatedVideos(): Video[] {
    const start = (this.currentPage - 1) * this.PAGE_SIZE;
    return this.videos.slice(start, start + this.PAGE_SIZE);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.videos.length / this.PAGE_SIZE));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
    this.cdr.detectChanges();
  }

  @ViewChild('archivoInput') archivoInput!: ElementRef<HTMLInputElement>;

  private cdr        = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  constructor(
    protected videoService: VideoService,
    private  grupoService:  GrupoService,
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

  // ── Subida ─────────────────────────────────────────────────────────────────

  /** Valida el tipo MIME antes de aceptar el archivo. */
  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;

    if (file && !file.type.startsWith('video/')) {
      this.estadoSubida = 'error';
      this.mensajeError = 'Solo se permiten archivos de vídeo (MP4, MOV, WebM…).';
      this.archivoSeleccionado = null;
      input.value = '';
      return;
    }

    this.archivoSeleccionado = file;
    if (this.estadoSubida === 'error') {
      this.estadoSubida = 'idle';
      this.mensajeError = '';
    }
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
        finalize(() => {
          if (this.estadoSubida === 'uploading') this.estadoSubida = 'idle';
        })
      )
      .subscribe({
        next: (res) => {
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

  // ── Eliminación ────────────────────────────────────────────────────────────

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
          this.videos = this.videos.filter(v => v.idVideo !== video.idVideo);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('[VideosComponent] Error al eliminar vídeo:', {
            status:     err?.status,
            statusText: err?.statusText,
            body:       err?.error,
          });
          this.mostrarErrorEliminacion(
            err?.error?.error || err?.error?.mensaje ||
            `No se pudo eliminar el vídeo (${err?.status ?? 'sin conexión'}). Inténtalo de nuevo.`
          );
          this.cdr.detectChanges();
        }
      });
  }

  private mostrarErrorEliminacion(mensaje: string): void {
    if (this.errorEliminacionTimer) clearTimeout(this.errorEliminacionTimer);
    this.errorEliminacion        = mensaje;
    this.errorEliminacionVisible = true;
    this.cdr.detectChanges();
    this.errorEliminacionTimer = setTimeout(() => {
      this.errorEliminacionVisible = false;
      this.cdr.detectChanges();
    }, 6000);
  }

  // ── Edición ────────────────────────────────────────────────────────────────

  iniciarEdicion(video: Video): void {
    this.videoEnEdicion = video;
    this.editTitulo     = video.titulo;
    const grupoActual   = video.grupo
      ? this.misGrupos.find(g => g.nombre === video.grupo!.nombre)
      : null;
    this.editIdGrupo    = grupoActual?.idGrupo ?? null;
    this.estadoEdicion  = 'idle';
    this.mensajeEdicion = '';
    this.cdr.detectChanges();
  }

  cancelarEdicion(): void {
    this.videoEnEdicion = null;
    this.estadoEdicion  = 'idle';
    this.cdr.detectChanges();
  }

  guardarEdicion(): void {
    const video = this.videoEnEdicion;
    if (!video || !this.editTitulo.trim()) return;

    this.estadoEdicion = 'saving';

    this.videoService.editarVideo(video.idVideo, this.editTitulo.trim(), this.editIdGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const grupoNuevo = this.editIdGrupo
            ? this.misGrupos.find(g => g.idGrupo === this.editIdGrupo)
            : null;

          this.videos = this.videos.map(v =>
            v.idVideo === video.idVideo
              ? { ...v, titulo: this.editTitulo.trim(), grupo: grupoNuevo ? { nombre: grupoNuevo.nombre } : undefined }
              : v
          );
          this.videoEnEdicion = null;
          this.estadoEdicion  = 'idle';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.estadoEdicion  = 'error';
          this.mensajeEdicion = err?.error?.error || err?.error?.mensaje || 'No se pudo guardar el cambio.';
          this.cdr.detectChanges();
        }
      });
  }

  // ── Reproductor ────────────────────────────────────────────────────────────

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

  onHeartbeat(currentTime: number): void {
    const idVideo = this.videoReproduciendose?.idVideo;
    if (!idVideo) return;

    const segundos = Math.floor(currentTime);
    this.videoService.registrarHeartbeat(idVideo, segundos)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (err) => console.warn('[Heartbeat] Error al registrar:', err?.status, err?.message),
      });
  }
}
