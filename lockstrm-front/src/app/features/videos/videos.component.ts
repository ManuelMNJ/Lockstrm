import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { VideoService, Video } from '../../core/services/video.service';
import { GroupService, Group } from '../../core/services/group.service';
import { VideoPlayerComponent } from './video-player/video-player.component';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';
import { ThumbnailSrcPipe } from '../../shared/pipes/thumbnail-src.pipe';
import { Paginator } from '../../shared/utils/paginator';
import { extractHttpErrorMessage } from '../../shared/utils/error-utils';
import { UI_TIMINGS, FILE_LIMITS, PAGINATION } from '../../shared/utils/ui-constants';

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, VideoPlayerComponent, VideoDurationPipe, ThumbnailSrcPipe],
  templateUrl: './videos.component.html',
  styleUrl: './videos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideosComponent implements OnInit {

  videos: Video[] = [];
  misGrupos: Group[] = [];
  archivoSeleccionado: File | null = null;
  tituloVideo = '';
  /**
   * Set de grupos seleccionados en el modal de subida. Un vídeo puede subirse
   * directamente vinculado a varios grupos (N:M). Se materializa como Set
   * para que el toggle de un checkbox sea O(1) y no haya duplicados.
   */
  idGruposSeleccionados = new Set<number>();
  /** Blob JPEG para subir al backend como multipart. */
  miniaturaBlob:    Blob   | null = null;
  /**
   * URL temporal (createObjectURL) usada solo para mostrar la preview en el
   * formulario. Se revoca al cerrar / subir para liberar memoria.
   */
  miniaturaPreviewUrl: string | null = null;
  private duracionVideo = 0;
  private objectUrl: string | null = null;

  /** Controla si el panel de subida está visible. */
  uploadPanelOpen = false;

  abrirPanelSubida(): void {
    this.uploadPanelOpen = true;
    this.cdr.markForCheck();
  }

  cerrarPanelSubida(): void {
    this.uploadPanelOpen = false;
    this.cdr.markForCheck();
  }

  estadoSubida: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
  progreso = 0;
  mensajeError = '';

  cargando = true;
  listaError = '';

  isDragging = false;

  deletingIds   = new Set<number>();
  failedThumbs  = new Set<number>();

  onThumbError(idVideo: number): void {
    this.failedThumbs = new Set(this.failedThumbs).add(idVideo);
    this.cdr.markForCheck();
  }

  errorEliminacion = '';
  errorEliminacionVisible = false;
  private errorEliminacionTimer: ReturnType<typeof setTimeout> | null = null;

  avisoAcceso = '';
  avisoAccesoVisible = false;
  private avisoAccesoTimer: ReturnType<typeof setTimeout> | null = null;

  videoAEliminar: Video | null = null;
  videoReproduciendose: Video | null = null;

  videoEnEdicion: Video | null = null;
  editTitulo    = '';
  /** Set de grupos marcados en el modal de edición. Mismo motivo que el de subida. */
  editIdGrupos  = new Set<number>();
  estadoEdicion: 'idle' | 'saving' | 'error' = 'idle';
  mensajeEdicion = '';

  exitoEdicionVisible = false;
  private exitoEdicionTimer: ReturnType<typeof setTimeout> | null = null;

  exitoSubidaVisible = false;
  private exitoSubidaTimer: ReturnType<typeof setTimeout> | null = null;

  storageUsedGB  = '0.0';
  storageLimitGB = '5';
  storagePercent = 0;

  private aplicarEspacio(usedBytes: number, limitBytes: number): void {
    const usedMB  = usedBytes  / (1024 * 1024);
    const limitMB = limitBytes / (1024 * 1024);
    this.storagePercent = limitMB ? Math.round(usedMB / limitMB * 100) : 0;
    this.storageUsedGB  = (usedMB  / 1024).toFixed(1);
    this.storageLimitGB = (limitMB / 1024).toFixed(0);
  }

  searchQuery = '';

  get filteredVideos(): Video[] {
    const q = this.searchQuery.trim().toLowerCase();
    return q ? this.videos.filter(v => v.titulo.toLowerCase().includes(q)) : this.videos;
  }

  onSearchChange(): void {
    this.paginator.setItems(this.filteredVideos);
    this.paginator.goToPage(1);
    this.cdr.markForCheck();
  }

  readonly paginator = new Paginator<Video>(PAGINATION.VIDEOS_PAGE_SIZE);

  goToPage(page: number): void {
    this.paginator.goToPage(page);
    this.cdr.markForCheck();
  }

  @ViewChild('archivoInput') archivoInput!: ElementRef<HTMLInputElement>;

  private cdr        = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  constructor(
    protected videoService: VideoService,
    private  grupoService:  GroupService,
    private  route:         ActivatedRoute,
  ) {}

  private refresh(): void {
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.videoEnEdicion)       { this.cancelarEdicion();    return; }
    if (this.videoAEliminar)       { this.cancelarEliminacion(); return; }
    if (this.videoReproduciendose) { this.cerrarReproductor();   return; }
    if (this.uploadPanelOpen)      { this.cerrarPanelSubida();   return; }
  }

  ngOnInit(): void {
    const aviso = this.route.snapshot.queryParamMap.get('aviso');
    if (aviso === 'sin-acceso-analiticas') {
      this.mostrarAvisoAcceso('No tienes permiso para ver las analíticas de ese vídeo.');
    }

    if (this.route.snapshot.queryParamMap.get('upload') === '1') {
      this.uploadPanelOpen = true;
    }

    this.cargarVideos();
    this.videoService.obtenerEspacio()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (info) => { this.aplicarEspacio(info.usedBytes, info.limitBytes); this.cdr.markForCheck(); },
        error: () => {},
      });
    this.grupoService.obtenerGruposCreados()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupos) => {
          this.misGrupos = grupos;
          this.cdr.markForCheck();
        },
        error: () => {}
      });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.isDragging) { this.isDragging = true; this.cdr.markForCheck(); }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    this.cdr.markForCheck();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) this.procesarArchivo(file);
    this.cdr.markForCheck();
  }

  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    if (file) this.procesarArchivo(file);
  }

  private procesarArchivo(file: File): void {
    if (!file.type.startsWith('video/')) {
      this.estadoSubida    = 'error';
      this.mensajeError    = 'Solo se permiten archivos de vídeo (MP4, MOV, WebM…).';
      this.archivoSeleccionado = null;
      this.cdr.markForCheck();
      return;
    }
    this.archivoSeleccionado = file;
    this.miniaturaBlob       = null;
    if (this.miniaturaPreviewUrl) { URL.revokeObjectURL(this.miniaturaPreviewUrl); this.miniaturaPreviewUrl = null; }
    this.duracionVideo       = 0;
    if (this.estadoSubida === 'error') { this.estadoSubida = 'idle'; this.mensajeError = ''; }
    this.cdr.markForCheck();
    this.generarMiniatura(file);
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
      this.duracionVideo = Math.round(video.duration);
      video.currentTime  = Math.min(2, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas    = document.createElement('canvas');
      canvas.width    = 320;
      canvas.height   = 180;
      const ctx       = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // toBlob es asíncrono: producimos un Blob real en lugar del data URL
      // para poder enviarlo como MultipartFile al backend.
      canvas.toBlob(blob => {
        this.miniaturaBlob = blob;
        // URL temporal solo para la preview en formulario; se revoca al subir.
        if (this.miniaturaPreviewUrl) URL.revokeObjectURL(this.miniaturaPreviewUrl);
        this.miniaturaPreviewUrl = blob ? URL.createObjectURL(blob) : null;
        this.cdr.markForCheck();
      }, 'image/jpeg', 0.75);
      video.src = '';
      URL.revokeObjectURL(this.objectUrl!);
      this.objectUrl = null;
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

    // FILE_LIMITS.VIDEO_BYTES debe coincidir con spring.servlet.multipart.max-file-size
    // en application.properties (el back admite 10 MB extra en max-request-size).
    if (this.archivoSeleccionado.size > FILE_LIMITS.VIDEO_BYTES) {
      this.estadoSubida = 'error';
      this.mensajeError = `El video supera el limite de ${FILE_LIMITS.VIDEO_MB} MB.`;
      return;
    }

    this.estadoSubida = 'uploading';
    this.progreso     = 0;
    this.mensajeError = '';

    this.videoService.subirVideo(this.archivoSeleccionado, this.tituloVideo, [...this.idGruposSeleccionados], this.miniaturaBlob, this.duracionVideo)
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
          // Reconstruimos la lista de grupos a partir de los seleccionados en el
          // formulario y el catálogo `misGrupos`. El backend ya validó cada
          // pertenencia; aquí solo necesitamos el nombre para el render inmediato
          // sin esperar a refetchear.
          const grupos = [...this.idGruposSeleccionados]
            .map(id => this.misGrupos.find(g => g.idGrupo === id))
            .filter((g): g is Group => g != null)
            .map(g => ({ idGrupo: g.idGrupo, nombre: g.nombre }));

          const nuevoVideo: Video = {
            idVideo:      res.id_video,
            titulo:       res.titulo,
            duracion:     res.duracion ?? null,
            fechaSubida:  new Date().toISOString(),
            grupos,
            // El backend devuelve la ruta pública resuelta o null si no hubo miniatura.
            miniaturaUrl: res.miniaturaUrl || null,
            fileName:     res.fileName,
          };

          // Empuja al BehaviorSubject: dashboard y cualquier otro suscriptor se actualizan
          this.videoService.prependVideo(nuevoVideo);
          this.videoService.obtenerEspacio().pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: (info) => { this.aplicarEspacio(info.usedBytes, info.limitBytes); this.cdr.markForCheck(); } });
          this.estadoSubida        = 'success';
          this.progreso            = 0;
          this.tituloVideo         = '';
          this.archivoSeleccionado = null;
          this.idGruposSeleccionados = new Set<number>();
          this.miniaturaBlob       = null;
          if (this.miniaturaPreviewUrl) { URL.revokeObjectURL(this.miniaturaPreviewUrl); this.miniaturaPreviewUrl = null; }
          this.archivoInput.nativeElement.value = '';
          this.cdr.markForCheck();

          // Cierra el panel automáticamente y lanza el toast externo
          setTimeout(() => {
            this.estadoSubida    = 'idle';
            this.uploadPanelOpen = false;
            this.mostrarExitoSubida();
            this.cdr.markForCheck();
          }, UI_TIMINGS.FEEDBACK_SHORT_MS);
        },
        error: (err) => {
          this.estadoSubida = 'error';
          this.progreso     = 0;
          this.mensajeError = extractHttpErrorMessage(err, 'Error al subir. Inténtalo de nuevo.');
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
          this.videoService.obtenerEspacio().pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: (info) => { this.aplicarEspacio(info.usedBytes, info.limitBytes); this.cdr.markForCheck(); } });
        },
        error: (err) => {
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
    }, UI_TIMINGS.TOAST_EDIT_MS);
  }

  private mostrarExitoSubida(): void {
    if (this.exitoSubidaTimer) clearTimeout(this.exitoSubidaTimer);
    this.exitoSubidaVisible = true;
    this.refresh();
    this.exitoSubidaTimer = setTimeout(() => {
      this.exitoSubidaVisible = false;
      this.refresh();
    }, UI_TIMINGS.TOAST_UPLOAD_MS);
  }

  private mostrarErrorEliminacion(mensaje: string): void {
    if (this.errorEliminacionTimer) clearTimeout(this.errorEliminacionTimer);
    this.errorEliminacion = mensaje;
    this.errorEliminacionVisible = true;
    this.refresh();
    this.errorEliminacionTimer = setTimeout(() => {
      this.errorEliminacionVisible = false;
      this.refresh();
    }, UI_TIMINGS.TOAST_ERROR_MS);
  }

  private mostrarAvisoAcceso(mensaje: string): void {
    if (this.avisoAccesoTimer) clearTimeout(this.avisoAccesoTimer);
    this.avisoAcceso = mensaje;
    this.avisoAccesoVisible = true;
    this.refresh();
    this.avisoAccesoTimer = setTimeout(() => {
      this.avisoAccesoVisible = false;
      this.refresh();
    }, UI_TIMINGS.TOAST_ERROR_MS);
  }

  iniciarEdicion(video: Video): void {
    this.videoEnEdicion = video;
    this.editTitulo     = video.titulo;
    this.editIdGrupos   = new Set(video.grupos.map(g => g.idGrupo));
    this.estadoEdicion  = 'idle';
    this.mensajeEdicion = '';
    this.cdr.markForCheck();
  }

  /**
   * Toggle helper para los checkboxes de grupos. Devuelve un nuevo Set para
   * que el ChangeDetector OnPush detecte el cambio (Set mutado in-place no
   * dispararía repintado).
   */
  toggleGrupoSubida(idGrupo: number): void {
    const next = new Set(this.idGruposSeleccionados);
    next.has(idGrupo) ? next.delete(idGrupo) : next.add(idGrupo);
    this.idGruposSeleccionados = next;
    this.cdr.markForCheck();
  }

  toggleGrupoEdicion(idGrupo: number): void {
    const next = new Set(this.editIdGrupos);
    next.has(idGrupo) ? next.delete(idGrupo) : next.add(idGrupo);
    this.editIdGrupos = next;
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

    this.videoService.editarVideo(video.idVideo, this.editTitulo.trim(), [...this.editIdGrupos])
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
          this.paginator.setItems(this.filteredVideos);
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.listaError = `No se pudo cargar la biblioteca (${err?.status ?? 'sin conexion'}). Recarga la pagina.`;
          this.cargando   = false;
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

  /**
   * En "Mis vídeos" no existe un contexto de grupo único: un vídeo puede
   * pertenecer a varios y el propietario lo está abriendo desde su biblioteca,
   * no desde la página de un grupo concreto. Por eso forzamos `grupoId: null`
   * en el heartbeat — esa fila de `logs` representa la visualización del
   * propietario fuera de cualquier grupo, que se contabiliza aparte.
   */
  onHeartbeat(payload: { currentTime: number; sessionId: string; grupoId: number | null }): void {
    const idVideo = this.videoReproduciendose?.idVideo;
    if (!idVideo) return;
    this.videoService.registrarHeartbeat(idVideo, payload.currentTime, payload.sessionId, null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => {} });
  }
}
