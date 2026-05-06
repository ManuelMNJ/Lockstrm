import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { VideoService, Video, VideoVistaEstadistica } from '../../../../core/services/video.service';
import { ThumbnailSrcPipe } from '../../../../shared/pipes/thumbnail-src.pipe';
import { VideoDurationPipe } from '../../../../shared/pipes/video-duration.pipe';
import { VideoPlayerComponent } from '../../../videos/video-player/video-player.component';
import { extractHttpErrorMessage } from '../../../../shared/utils/error-utils';
import { CustomSelectComponent, SelectOption } from '../../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-group-videos',
  standalone: true,
  imports: [FormsModule, ThumbnailSrcPipe, VideoDurationPipe, VideoPlayerComponent, CustomSelectComponent],
  templateUrl: './group-videos.component.html',
  styleUrls: ['../group-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupVideosComponent {

  @Input() idGrupo!: number;
  @Input() rolActual: string | null = null;
  @Input() videosGrupo: Video[] = [];
  @Input() misVideosDisponibles: Video[] = [];

  @Output() videosChanged = new EventEmitter<{ videosGrupo: Video[]; misVideosDisponibles: Video[] }>();

  idVideoAAnadir: number | null = null;
  estadoAnadirVideo: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  errorAnadirVideo = '';
  quitandoVideos = new Set<number>();
  failedThumbs   = new Set<number>();
  errorVideos    = '';

  videoReproduciendose: Video | null = null;

  videoStats: Video | null = null;
  estadisticas: VideoVistaEstadistica[] = [];
  cargandoStats = false;
  errorStats    = '';

  criterioOrden: string = 'fechaDesc';

  readonly sortOptions: SelectOption[] = [
    { value: 'fechaDesc',    label: 'Más recientes'  },
    { value: 'fechaAsc',     label: 'Más antiguos'   },
    { value: 'duracionDesc', label: 'Mayor duración'  },
    { value: 'duracionAsc',  label: 'Menor duración'  },
    { value: 'nombreAsc',    label: 'Nombre (A-Z)'   },
  ];

  private destroyRef = inject(DestroyRef);

  constructor(
    protected videoService: VideoService,
    private cdr: ChangeDetectorRef,
  ) {}

  get esAdmin(): boolean {
    return this.rolActual === 'ADMIN' || this.rolActual === 'SUPER_ADMIN';
  }

  get puedeGestionarVideos(): boolean {
    return this.rolActual === 'SUPER_ADMIN' || this.rolActual === 'ADMIN' || this.rolActual === 'EDITOR';
  }

  get videoOptions(): SelectOption[] {
    return this.misVideosDisponibles.map(v => ({ value: v.idVideo, label: v.titulo }));
  }

  get videosGrupoOrdenados(): Video[] {
    return [...this.videosGrupo].sort((a, b) => {
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

  puedeQuitarVideo(video: Video): boolean {
    if (this.esAdmin) return true;
    return this.rolActual === 'EDITOR';
  }

  onCambioOrden(valor: string): void {
    this.criterioOrden = valor;
    this.cdr.markForCheck();
  }

  onThumbError(idVideo: number): void {
    this.failedThumbs = new Set(this.failedThumbs).add(idVideo);
    this.cdr.markForCheck();
  }

  aniadirVideoExistente(): void {
    if (this.idVideoAAnadir == null) return;
    const video = this.misVideosDisponibles.find(v => v.idVideo === this.idVideoAAnadir);
    if (!video) return;

    this.estadoAnadirVideo = 'loading';
    this.errorAnadirVideo  = '';
    this.cdr.markForCheck();

    const idGruposSet = new Set(video.grupos.map(g => g.idGrupo));
    idGruposSet.add(this.idGrupo);
    this.videoService.editarVideo(video.idVideo, video.titulo, [...idGruposSet])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.idVideoAAnadir    = null;
          this.estadoAnadirVideo = 'success';
          this.cdr.markForCheck();
          this.recargarVideos();
          setTimeout(() => { this.estadoAnadirVideo = 'idle'; this.cdr.markForCheck(); }, 3000);
        },
        error: (err) => {
          this.estadoAnadirVideo = 'error';
          this.errorAnadirVideo  = extractHttpErrorMessage(err, 'No se pudo añadir el vídeo.');
          this.cdr.markForCheck();
        },
      });
  }

  quitarVideoDelGrupo(video: Video): void {
    this.quitandoVideos = new Set(this.quitandoVideos).add(video.idVideo);

    const nuevosGrupos = video.grupos.filter(g => g.idGrupo !== this.idGrupo);

    this.videoService.editarVideo(video.idVideo, video.titulo, nuevosGrupos.map(g => g.idGrupo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const next = new Set(this.quitandoVideos);
          next.delete(video.idVideo);
          this.quitandoVideos = next;
          const videosGrupo = this.videosGrupo.filter(v => v.idVideo !== video.idVideo);
          const misVideosDisponibles = [...this.misVideosDisponibles, { ...video, grupos: nuevosGrupos }];
          this.videosChanged.emit({ videosGrupo, misVideosDisponibles });
          this.cdr.markForCheck();
        },
        error: () => {
          const next = new Set(this.quitandoVideos);
          next.delete(video.idVideo);
          this.quitandoVideos = next;
          this.cdr.markForCheck();
        },
      });
  }

  verVideo(video: Video): void {
    this.videoReproduciendose = video;
    this.cdr.markForCheck();
  }

  cerrarReproductor(): void {
    this.videoReproduciendose = null;
    this.cdr.markForCheck();
  }

  onHeartbeat(payload: { currentTime: number; sessionId: string; grupoId: number | null }): void {
    const idVideo = this.videoReproduciendose?.idVideo;
    if (!idVideo) return;
    this.videoService.registrarHeartbeat(idVideo, payload.currentTime, payload.sessionId, payload.grupoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => {} });
  }

  abrirStats(video: Video): void {
    this.videoStats    = video;
    this.estadisticas  = [];
    this.cargandoStats = true;
    this.errorStats    = '';
    this.cdr.markForCheck();

    this.videoService.obtenerEstadisticas(video.idVideo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.estadisticas  = data;
          this.cargandoStats = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorStats    = 'No se pudieron cargar las estadísticas.';
          this.cargandoStats = false;
          this.cdr.markForCheck();
        },
      });
  }

  cerrarStats(): void {
    this.videoStats = null;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.videoReproduciendose) { this.cerrarReproductor(); return; }
    if (this.videoStats)           { this.cerrarStats();       return; }
  }

  private recargarVideos(): void {
    const videosGrupo$ = this.videoService.obtenerVideosPorGrupo(this.idGrupo);
    const misVideos$ = this.puedeGestionarVideos
      ? this.videoService.obtenerMisVideos().pipe(take(1))
      : of([] as Video[]);

    forkJoin({ videosGrupo: videosGrupo$, misVideos: misVideos$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ videosGrupo, misVideos }) => {
          const misVideosDisponibles = misVideos.filter(
            v => !v.grupos.some(g => g.idGrupo === this.idGrupo)
          );
          this.videosChanged.emit({ videosGrupo, misVideosDisponibles });
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorVideos = 'No se pudieron cargar los vídeos del grupo.';
          this.cdr.markForCheck();
        },
      });
  }
}
