import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { VideoService, Video } from '../../core/services/video.service';
import { GrupoService, Grupo } from '../../core/services/grupo.service';
import { VideoPlayerComponent } from './video-player/video-player.component';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';
import { Paginator } from '../../shared/utils/paginator';
import { extractHttpErrorMessage } from '../../shared/utils/error-utils';

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, A11yModule, VideoPlayerComponent, VideoDurationPipe],
  templateUrl: './videos.component.html',
  styleUrl: './videos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideosComponent implements OnInit {

  videos: Video[] = [];
  misGrupos: Grupo[] = [];
  archivoSeleccionado: File | null = null;
  tituloVideo = '';
  idGrupoSeleccionado: number | null = null;
  miniaturaDataUrl: string | null = null;
  private objectUrl: string | null = null;

  estadoSubida: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
  progreso = 0;
  mensajeError = '';

  cargando = true;
  listaError = '';

  deletingIds = new Set<number>();

  errorEliminacion = '';
  errorEliminacionVisible = false;
  private errorEliminacionTimer: ReturnType<typeof setTimeout> | null = null;

  videoAEliminar: Video | null = null;
  videoReproduciendose: Video | null = null;

  videoEnEdicion: Video | null = null;
  editTitulo    = '';
  editIdGrupo: number | null = null;
  estadoEdicion: 'idle' | 'saving' | 'error' = 'idle';
  mensajeEdicion = '';

  exitoEdicionVisible = false;
  private exitoEdicionTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Espacio de almacenamiento (hardcoded hasta que el backend lo exponga) ──
  readonly storageMB      = 1229;               // 1.2 GB
  readonly storageLimitMB = 5120;               // 5 GB
  readonly storagePercent = Math.round(this.storageMB / this.storageLimitMB * 100);
  readonly storageUsedGB  = (this.storageMB / 1024).toFixed(1);
  readonly storageLimitGB = (this.storageLimitMB / 1024).toFixed(0);

  readonly paginator = new Paginator<Video>(15);

  goToPage(page: number): void {
    this.paginator.goToPage(page);
    this.cdr.markForCheck();
  }

  @ViewChild('archivoInput') archivoInput!: ElementRef<HTMLInputElement>;

  private cdr        = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  constructor(
    protected videoService: VideoService,
    private  grupoService:  GrupoService,
  ) {}

  private refresh(): void {
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.videoEnEdicion)    { this.cancelarEdicion();    return; }
    if (this.videoAEliminar)    { this.cancelarEliminacion(); return; }
    if (this.videoReproduciendose) { this.cerrarReproductor(); }
  }

  ngOnInit(): void {
    this.cargarVideos();
    this.grupoService.obtenerGruposParaDesplegable()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupos) => {
          this.misGrupos = grupos;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('[VideosComponent] Error al cargar grupos:', err)
      });
  }

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
    this.miniaturaDataUrl    = null;
    if (this.estadoSubida === 'error') {
      this.estadoSubida = 'idle';
      this.mensajeError = '';
    }

    if (file) this.generarMiniatura(file);
  }

  private generarMiniatura(file: File): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
    this.objectUrl = URL.createObjectURL(file);

    const video = document.createElement('video');
    video.preload     = 'metadata';
    video.muted       = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(2, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas    = document.createElement('canvas');
      canvas.width    = 320;
      canvas.height   = 180;
      const ctx       = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      this.miniaturaDataUrl = canvas.toDataURL('image/jpeg', 0.75);
      video.src = '';
      URL.revokeObjectURL(this.objectUrl!);
      this.objectUrl = null;
      this.cdr.markForCheck();
    };

    video.onerror = () => {
      if (this.objectUrl) {
        URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = null;
      }
    };

    video.src = this.objectUrl;
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
    this.progreso     = 0;
    this.mensajeError = '';

    this.videoService.subirVideo(this.archivoSeleccionado, this.tituloVideo, this.idGrupoSeleccionado, this.miniaturaDataUrl)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (this.estadoSubida === 'uploading') this.estadoSubida = 'idle';
          this.progreso = 0;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.progreso = Math.round(100 * event.loaded / event.total);
            this.cdr.markForCheck();
            return;
          }

          if (event.type !== HttpEventType.Response) return;

          const res = event.body!;
          const grupo = this.idGrupoSeleccionado
            ? (this.misGrupos.find(g => g.idGrupo === this.idGrupoSeleccionado) ?? null)
            : null;

          const nuevoVideo: Video = {
            idVideo:      res.id_video,
            titulo:       res.titulo,
            duracion:     res.duracion ?? null,
            fechaSubida:  new Date().toISOString(),
            grupo:        grupo ? { idGrupo: grupo.idGrupo, nombre: grupo.nombre } : undefined,
            miniaturaUrl: res.miniaturaUrl ?? this.miniaturaDataUrl,
          };

          // Empuja al BehaviorSubject: dashboard y cualquier otro suscriptor se actualizan
          this.videoService.prependVideo(nuevoVideo);
          this.estadoSubida        = 'success';
          this.progreso            = 0;
          this.tituloVideo         = '';
          this.archivoSeleccionado = null;
          this.idGrupoSeleccionado = null;
          this.miniaturaDataUrl    = null;
          this.archivoInput.nativeElement.value = '';
          this.cdr.markForCheck();

          setTimeout(() => {
            this.estadoSubida = 'idle';
            this.cdr.markForCheck();
          }, 3000);
        },
        error: (err) => {
          this.estadoSubida = 'error';
          this.progreso     = 0;
          this.mensajeError = extractHttpErrorMessage(err, 'Error al subir. Comprueba la consola.');
          console.error('[VideosComponent] Error en subida:', {
            status:     err?.status,
            statusText: err?.statusText,
            body:       err?.error,
          });
          this.refresh();
        }
      });
  }

  solicitarEliminacion(video: Video): void {
    this.videoAEliminar = video;
    this.cdr.markForCheck();
  }

  cancelarEliminacion(): void {
    this.videoAEliminar = null;
    this.cdr.markForCheck();
  }

  confirmarEliminacion(): void {
    const video = this.videoAEliminar;
    if (!video) return;

    this.videoAEliminar = null;
    this.deletingIds = new Set(this.deletingIds).add(video.idVideo);
    this.cdr.markForCheck();

    this.videoService.eliminarVideo(video.idVideo)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.deletingIds = new Set(this.deletingIds);
          this.deletingIds.delete(video.idVideo);
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          // El tap de eliminarVideo() actualizó el BehaviorSubject;
          // la suscripción en cargarVideos() ya aplicó el nuevo array.
        },
        error: (err) => {
          console.error('[VideosComponent] Error al eliminar vídeo:', {
            status:     err?.status,
            statusText: err?.statusText,
            body:       err?.error,
          });
          this.mostrarErrorEliminacion(
            extractHttpErrorMessage(err, `No se pudo eliminar el vídeo (${err?.status ?? 'sin conexión'}). Inténtalo de nuevo.`)
          );
          this.refresh();
        }
      });
  }

  private mostrarExitoEdicion(): void {
    if (this.exitoEdicionTimer) clearTimeout(this.exitoEdicionTimer);
    this.exitoEdicionVisible = true;
    this.refresh();
    this.exitoEdicionTimer = setTimeout(() => {
      this.exitoEdicionVisible = false;
      this.refresh();
    }, 3500);
  }

  private mostrarErrorEliminacion(mensaje: string): void {
    if (this.errorEliminacionTimer) clearTimeout(this.errorEliminacionTimer);
    this.errorEliminacion = mensaje;
    this.errorEliminacionVisible = true;
    this.refresh();
    this.errorEliminacionTimer = setTimeout(() => {
      this.errorEliminacionVisible = false;
      this.refresh();
    }, 6000);
  }

  iniciarEdicion(video: Video): void {
    this.videoEnEdicion = video;
    this.editTitulo     = video.titulo;
    this.editIdGrupo    = video.grupo?.idGrupo ?? null;
    this.estadoEdicion  = 'idle';
    this.mensajeEdicion = '';
    this.cdr.markForCheck();
  }

  cancelarEdicion(): void {
    this.videoEnEdicion = null;
    this.estadoEdicion  = 'idle';
    this.cdr.markForCheck();
  }

  guardarEdicion(): void {
    const video = this.videoEnEdicion;
    if (!video || !this.editTitulo.trim()) return;

    this.estadoEdicion = 'saving';

    this.videoService.editarVideo(video.idVideo, this.editTitulo.trim(), this.editIdGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // El tap de editarVideo() actualizó el BehaviorSubject con los datos del servidor;
          // la suscripción en cargarVideos() ya aplicó el nuevo array.
          this.videoEnEdicion = null;
          this.estadoEdicion  = 'idle';
          this.mostrarExitoEdicion();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.estadoEdicion  = 'error';
          this.mensajeEdicion = extractHttpErrorMessage(err, 'No se pudo guardar el cambio.');
          this.refresh();
        }
      });
  }

  cargarVideos(): void {
    this.listaError = '';
    this.cargando   = true;
    this.videoService.obtenerMisVideos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => {
          this.videos   = datos;
          this.paginator.setItems(datos);
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.listaError = `No se pudo cargar la biblioteca (${err?.status ?? 'sin conexion'}). Recarga la pagina.`;
          this.cargando   = false;
          console.error('[VideosComponent] Error al cargar videos:', err);
          this.refresh();
        }
      });
  }

  abrirReproductor(video: Video): void {
    this.videoReproduciendose = video;
    this.cdr.markForCheck();
  }

  cerrarReproductor(): void {
    this.videoReproduciendose = null;
    this.cdr.markForCheck();
  }

  onHeartbeat(currentTime: number): void {
    const idVideo = this.videoReproduciendose?.idVideo;
    if (!idVideo) return;
    this.videoService.registrarHeartbeat(idVideo, currentTime)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (err) => console.warn('[Heartbeat] Error al registrar:', err?.status, err?.message),
      });
  }
}
