import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, NgZone, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, catchError, concatMap, filter, finalize, from, map, of, tap } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { VideoService, Video } from '../../core/services/video.service';
import { GroupService, Group } from '../../core/services/group.service';
import { CustomSelectComponent, SelectOption } from '../../shared/components/custom-select/custom-select.component';
import { VideoPlayerComponent } from './video-player/video-player.component';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';
import { ThumbnailSrcPipe } from '../../shared/pipes/thumbnail-src.pipe';
import { Paginator } from '../../shared/utils/paginator';
import { extractHttpErrorMessage } from '../../shared/utils/error-utils';
import { UI_TIMINGS, FILE_LIMITS, PAGINATION } from '../../shared/utils/ui-constants';

export interface VideoUploadItem {
  file: File;
  titulo: string;
  miniaturaBlob: Blob | null;
  miniaturaPreviewUrl: string | null;
  miniaturaPersonalizada: boolean;
  duracion: number;
  objectUrl: string | null;
  estado: 'pending' | 'uploading' | 'success' | 'error';
  progreso: number;
  error: string;
}

@Component({
  selector: 'app-videos',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, VideoPlayerComponent, VideoDurationPipe, ThumbnailSrcPipe, CustomSelectComponent],
  templateUrl: './videos.component.html',
  styleUrl: './videos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideosComponent implements OnInit {

  videos: Video[] = [];
  misGrupos: Group[] = [];
  uploadItems: VideoUploadItem[] = [];
  idGruposSeleccionados = new Set<number>();


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
  eliminarConfirmado = false;
  videoReproduciendose: Video | null = null;

  videoEnEdicion: Video | null = null;
  editTitulo    = '';
  editIdGrupos  = new Set<number>();
  editMiniaturaBlob:       Blob   | null = null;
  editMiniaturaPreviewUrl: string | null = null;
  estadoEdicion: 'idle' | 'saving' | 'error' = 'idle';
  mensajeEdicion = '';

  private editTituloOriginal = '';
  private editIdGruposOriginal = new Set<number>();
  confirmarDescartarEdicion = false;

  exitoEdicionVisible = false;
  private exitoEdicionTimer: ReturnType<typeof setTimeout> | null = null;

  exitoSubidaVisible = false;
  exitoSubidaCount   = 0;
  private exitoSubidaTimer: ReturnType<typeof setTimeout> | null = null;

  storageUsedGB  = '0.0';
  storageLimitGB = '5';
  storagePercent = 0;

  storageWarnVisible = false;
  private storageWarnTimer: ReturnType<typeof setTimeout> | null = null;
  private storageWarnShown80  = false;
  private storageWarnShown100 = false;

  private aplicarEspacio(usedBytes: number, limitBytes: number): void {
    const usedMB  = usedBytes  / (1024 * 1024);
    const limitMB = limitBytes / (1024 * 1024);
    this.storagePercent = limitMB ? Math.round(usedMB / limitMB * 100) : 0;
    this.storageUsedGB  = (usedMB  / 1024).toFixed(1);
    this.storageLimitGB = (limitMB / 1024).toFixed(0);
    this.comprobarAvisoEspacio();
  }

  private comprobarAvisoEspacio(): void {
    if (this.storagePercent >= 100 && !this.storageWarnShown100) {
      this.storageWarnShown100 = true;
      this.mostrarStorageWarn('Has alcanzado el límite de almacenamiento. No puedes subir más vídeos.');
    } else if (this.storagePercent >= 80 && !this.storageWarnShown80) {
      this.storageWarnShown80 = true;
      this.mostrarStorageWarn(`Casi sin espacio — llevas un ${this.storagePercent}% usado.`);
    }
  }

  storageWarnMsg = '';
  private mostrarStorageWarn(msg: string): void {
    if (this.storageWarnTimer) clearTimeout(this.storageWarnTimer);
    this.storageWarnMsg     = msg;
    this.storageWarnVisible = true;
    this.cdr.markForCheck();
    this.storageWarnTimer = setTimeout(() => {
      this.storageWarnVisible = false;
      this.cdr.markForCheck();
    }, UI_TIMINGS.TOAST_ERROR_MS);
  }

  searchQuery  = '';
  criterioOrden = 'fechaDesc';

  readonly sortOptions: SelectOption[] = [
    { value: 'fechaDesc',    label: 'Más recientes'  },
    { value: 'fechaAsc',     label: 'Más antiguos'   },
    { value: 'duracionDesc', label: 'Mayor duración' },
    { value: 'duracionAsc',  label: 'Menor duración' },
    { value: 'nombreAsc',    label: 'Nombre (A-Z)'   },
  ];

  get filteredVideos(): Video[] {
    const q = this.searchQuery.trim().toLowerCase();
    const base = q ? this.videos.filter(v => v.titulo.toLowerCase().includes(q)) : this.videos;
    return [...base].sort((a, b) => {
      switch (this.criterioOrden) {
        case 'fechaDesc':    return new Date(b.fechaSubida ?? 0).getTime() - new Date(a.fechaSubida ?? 0).getTime();
        case 'fechaAsc':     return new Date(a.fechaSubida ?? 0).getTime() - new Date(b.fechaSubida ?? 0).getTime();
        case 'duracionDesc': return (b.duracion ?? 0) - (a.duracion ?? 0);
        case 'duracionAsc':  return (a.duracion ?? 0) - (b.duracion ?? 0);
        case 'nombreAsc':    return a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' });
        default:             return 0;
      }
    });
  }

  onSearchChange(): void {
    this.paginator.setItems(this.filteredVideos);
    this.paginator.goToPage(1);
    this.cdr.markForCheck();
  }

  onCambioOrden(valor: string): void {
    this.criterioOrden = valor;
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
  private ngZone     = inject(NgZone);

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
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('video/'));
    this.procesarLote(files);
    this.cdr.markForCheck();
  }

  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.procesarLote(files);
  }

  private procesarLote(files: File[]): void {
    const disponibles = FILE_LIMITS.MAX_BATCH_UPLOAD - this.uploadItems.length;
    if (disponibles <= 0) {
      this.estadoSubida = 'error';
      this.mensajeError = `Máximo ${FILE_LIMITS.MAX_BATCH_UPLOAD} vídeos por lote.`;
      this.cdr.markForCheck();
      return;
    }
    files.slice(0, disponibles).forEach(f => this.procesarArchivo(f));
    if (files.length > disponibles) {
      this.mensajeError = `Se añadieron solo ${disponibles} vídeo(s); máximo ${FILE_LIMITS.MAX_BATCH_UPLOAD} por lote.`;
      this.estadoSubida = 'error';
      this.cdr.markForCheck();
    }
  }

  private procesarArchivo(file: File): void {
    if (!file.type.startsWith('video/')) {
      this.estadoSubida = 'error';
      this.mensajeError = 'Solo se permiten archivos de vídeo (MP4, MOV, WebM…).';
      this.cdr.markForCheck();
      return;
    }
    if (file.size > FILE_LIMITS.VIDEO_BYTES) {
      this.estadoSubida = 'error';
      this.mensajeError = `"${file.name}" supera el límite de ${FILE_LIMITS.VIDEO_MB} MB.`;
      this.cdr.markForCheck();
      return;
    }
    if (this.estadoSubida === 'error') { this.estadoSubida = 'idle'; this.mensajeError = ''; }
    const item: VideoUploadItem = {
      file,
      titulo: file.name.replace(/\.[^.]+$/, ''),
      miniaturaBlob: null,
      miniaturaPreviewUrl: null,
      miniaturaPersonalizada: false,
      duracion: 0,
      objectUrl: null,
      estado: 'pending',
      progreso: 0,
      error: '',
    };
    this.uploadItems = [...this.uploadItems, item];
    this.cdr.markForCheck();
    this.generarMiniatura(item);
  }

  private generarMiniatura(item: VideoUploadItem): void {
    if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    item.objectUrl = URL.createObjectURL(item.file);

    const video = document.createElement('video');
    video.preload     = 'metadata';
    video.muted       = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      item.duracion     = Math.round(video.duration);
      video.currentTime = Math.min(2, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas  = document.createElement('canvas');
      canvas.width  = 320;
      canvas.height = 180;
      canvas.getContext('2d')!.drawImage(video, 0, 0, 320, 180);
      canvas.toBlob(blob => {
        item.miniaturaBlob = blob;
        if (item.miniaturaPreviewUrl) URL.revokeObjectURL(item.miniaturaPreviewUrl);
        item.miniaturaPreviewUrl = blob ? URL.createObjectURL(blob) : null;
        this.uploadItems = [...this.uploadItems];
        this.cdr.markForCheck();
      }, 'image/jpeg', 0.75);
      video.src = '';
      URL.revokeObjectURL(item.objectUrl!);
      item.objectUrl = null;
    };

    video.onerror = () => {
      if (item.objectUrl) { URL.revokeObjectURL(item.objectUrl); item.objectUrl = null; }
    };

    video.src = item.objectUrl;
  }

  subir(): void {
    const items = this.uploadItems.filter(i => i.estado === 'pending' || i.estado === 'error');
    if (!items.length) {
      this.estadoSubida = 'error';
      this.mensajeError = 'Añade al menos un vídeo.';
      return;
    }
    const sinTitulo = items.find(i => !i.titulo.trim());
    if (sinTitulo) {
      this.estadoSubida = 'error';
      this.mensajeError = 'Todos los vídeos deben tener título.';
      return;
    }
    this.estadoSubida = 'uploading';
    this.mensajeError = '';

    from(items).pipe(
      concatMap(item => this.subirItem(item)),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.archivoInput.nativeElement.value = '';
        this.videoService.obtenerEspacio().pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({ next: (info) => { this.aplicarEspacio(info.usedBytes, info.limitBytes); this.cdr.markForCheck(); } });

        const exitosos    = this.uploadItems.filter(i => i.estado === 'success').length;
        const alguienFallo = this.uploadItems.some(i => i.estado === 'error');
        if (alguienFallo) {
          this.estadoSubida = 'error';
          this.mensajeError = exitosos > 0
            ? `${exitosos} vídeo${exitosos > 1 ? 's subidos' : ' subido'}, pero algunos no pudieron subirse.`
            : 'Los vídeos no pudieron subirse.';
        } else {
          this.uploadItems           = [];
          this.idGruposSeleccionados = new Set<number>();
          this.estadoSubida          = 'success';
          setTimeout(() => {
            this.estadoSubida    = 'idle';
            this.uploadPanelOpen = false;
            this.mostrarExitoSubida(exitosos);
            this.cdr.markForCheck();
          }, UI_TIMINGS.FEEDBACK_SHORT_MS);
        }
        this.cdr.markForCheck();
      })
    ).subscribe();
  }

  private subirItem(item: VideoUploadItem): Observable<void> {
    item.estado   = 'uploading';
    item.progreso = 0;
    item.error    = '';
    this.cdr.markForCheck();

    return this.videoService.subirVideo(item.file, item.titulo.trim(), [...this.idGruposSeleccionados], item.miniaturaBlob, item.duracion).pipe(
      tap(event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const loaded = event.loaded;
          const total  = event.total;
          this.ngZone.run(() => {
            item.progreso = Math.round(100 * loaded / total);
            this.cdr.markForCheck();
          });
        }
        if (event.type === HttpEventType.Response) {
          this.ngZone.run(() => {
            const res    = event.body!;
            const grupos = [...this.idGruposSeleccionados]
              .map(id => this.misGrupos.find(g => g.idGrupo === id))
              .filter((g): g is Group => g != null)
              .map(g => ({ idGrupo: g.idGrupo, nombre: g.nombre }));
            this.videoService.prependVideo({
              idVideo:       res.id_video,
              titulo:        res.titulo,
              duracion:      res.duracion ?? null,
              fechaSubida:   new Date().toISOString(),
              grupos,
              miniaturaUrl:  res.miniaturaUrl || null,
              fileName:      res.fileName,
              fileSize:      null,
              propietarioId: null,
            });
            item.estado = 'success';
            this.cdr.markForCheck();
          });
        }
      }),
      filter(event => event.type === HttpEventType.Response),
      map(() => void 0),
      catchError(err => {
        this.ngZone.run(() => {
          item.estado = 'error';
          item.error  = extractHttpErrorMessage(err, 'Error al subir. Inténtalo de nuevo.');
          this.cdr.markForCheck();
        });
        return of(void 0);
      })
    );
  }

  eliminarItem(item: VideoUploadItem): void {
    if (item.miniaturaPreviewUrl) URL.revokeObjectURL(item.miniaturaPreviewUrl);
    if (item.objectUrl)           URL.revokeObjectURL(item.objectUrl);
    this.uploadItems = this.uploadItems.filter(i => i !== item);
    this.cdr.markForCheck();
  }

  seleccionarMiniatura(item: VideoUploadItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (item.miniaturaPreviewUrl && item.miniaturaPersonalizada) {
      URL.revokeObjectURL(item.miniaturaPreviewUrl);
    }
    // File extiende Blob: se puede pasar directamente como miniaturaBlob
    item.miniaturaBlob         = file;
    item.miniaturaPreviewUrl   = URL.createObjectURL(file);
    item.miniaturaPersonalizada = true;
    this.uploadItems = [...this.uploadItems];
    this.cdr.markForCheck();
  }

  solicitarEliminacion(video: Video): void {
    this.videoAEliminar    = video;
    this.eliminarConfirmado = false;
    this.cdr.markForCheck();
  }

  cancelarEliminacion(): void {
    this.videoAEliminar    = null;
    this.eliminarConfirmado = false;
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

  private mostrarExitoSubida(count = 1): void {
    if (this.exitoSubidaTimer) clearTimeout(this.exitoSubidaTimer);
    this.exitoSubidaCount   = count;
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
    this.videoEnEdicion          = video;
    this.editTitulo              = video.titulo;
    this.editIdGrupos            = new Set(video.grupos.map(g => g.idGrupo));
    this.editMiniaturaBlob       = null;
    this.editMiniaturaPreviewUrl = null;
    this.estadoEdicion           = 'idle';
    this.mensajeEdicion          = '';
    this.editTituloOriginal      = video.titulo;
    this.editIdGruposOriginal    = new Set(video.grupos.map(g => g.idGrupo));
    this.confirmarDescartarEdicion = false;
    this.cdr.markForCheck();
  }

  private editTieneCambios(): boolean {
    if (this.editTitulo.trim() !== this.editTituloOriginal) return true;
    if (this.editMiniaturaBlob !== null) return true;
    if (this.editIdGrupos.size !== this.editIdGruposOriginal.size) return true;
    for (const id of this.editIdGrupos) { if (!this.editIdGruposOriginal.has(id)) return true; }
    return false;
  }

  seleccionarMiniaturaEdicion(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (this.editMiniaturaPreviewUrl) URL.revokeObjectURL(this.editMiniaturaPreviewUrl);
    this.editMiniaturaBlob       = file;
    this.editMiniaturaPreviewUrl = URL.createObjectURL(file);
    this.cdr.markForCheck();
  }

  /**
   * Alterna la selección de un grupo en los checkboxes de subida. Devuelve un
   * nuevo Set para que el ChangeDetector OnPush detecte el cambio (mutar el
   * Set in-place no dispararía repintado).
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
    if (this.editTieneCambios()) {
      this.confirmarDescartarEdicion = true;
      this.cdr.markForCheck();
      return;
    }
    this.descartarEdicion();
  }

  descartarEdicion(): void {
    if (this.editMiniaturaPreviewUrl) { URL.revokeObjectURL(this.editMiniaturaPreviewUrl); this.editMiniaturaPreviewUrl = null; }
    this.editMiniaturaBlob         = null;
    this.videoEnEdicion            = null;
    this.estadoEdicion             = 'idle';
    this.confirmarDescartarEdicion = false;
    this.cdr.markForCheck();
  }

  cerrarConfirmDescartar(): void {
    this.confirmarDescartarEdicion = false;
    this.cdr.markForCheck();
  }

  guardarEdicion(): void {
    const video = this.videoEnEdicion;
    if (!video || !this.editTitulo.trim()) return;

    this.estadoEdicion = 'saving';
    const blob = this.editMiniaturaBlob;

    this.videoService.editarVideo(video.idVideo, this.editTitulo.trim(), [...this.editIdGrupos])
      .pipe(
        concatMap(() => blob
          ? this.videoService.actualizarMiniatura(video.idVideo, blob)
          : of(null)
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (this.editMiniaturaPreviewUrl) { URL.revokeObjectURL(this.editMiniaturaPreviewUrl); this.editMiniaturaPreviewUrl = null; }
          this.editMiniaturaBlob = null;
          this.videoEnEdicion    = null;
          this.estadoEdicion     = 'idle';
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
