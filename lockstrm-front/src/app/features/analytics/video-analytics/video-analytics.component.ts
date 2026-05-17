import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, combineLatest } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { VideoService, Video, GrupoRef } from '../../../core/services/video.service';
import { AnalyticsService, VideoLog } from '../../../core/services/analytics.service';
import { VideoDurationPipe } from '../../../shared/pipes/video-duration.pipe';
import { ThumbnailSrcPipe } from '../../../shared/pipes/thumbnail-src.pipe';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-video-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, VideoDurationPipe, ThumbnailSrcPipe, CustomSelectComponent],
  templateUrl: './video-analytics.component.html',
  styleUrl: './video-analytics.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoAnalyticsComponent implements OnInit {

  video:        Video | null = null;
  logs:         VideoLog[]   = [];
  cargando      = true;
  error         = '';
  thumbFailed   = false;

  onThumbError(): void {
    this.thumbFailed = true;
    this.cdr.markForCheck();
  }

  filtroGrupo: 'all' | 'none' | number = 'all';

  grupoIdCtx: number | null = null;

  get fromGrupo(): boolean { return this.grupoIdCtx != null; }

  rangoActivo: '7d' | '30d' | '90d' | 'all' = 'all';

  private idVideo: number | null = null;

  private readonly route             = inject(ActivatedRoute);
  private readonly router            = inject(Router);
  private readonly videoService      = inject(VideoService);
  private readonly analiticasService = inject(AnalyticsService);
  private readonly cdr               = inject(ChangeDetectorRef);
  private readonly destroyRef        = inject(DestroyRef);

  ngOnInit(): void {
    const idVideo = Number(this.route.snapshot.paramMap.get('idVideo'));
    if (!idVideo) {
      this.error    = 'Vídeo no válido.';
      this.cargando = false;
      return;
    }
    this.idVideo = idVideo;

    const grupoStr = this.route.snapshot.paramMap.get('idGrupo');
    if (grupoStr) {
      this.grupoIdCtx  = Number(grupoStr);
      this.filtroGrupo = this.grupoIdCtx;
    }

    const rangoParam = this.route.snapshot.queryParamMap.get('rango');
    if (rangoParam === '7d' || rangoParam === '30d' || rangoParam === '90d') {
      this.rangoActivo = rangoParam;
    }

    this.cargarTodo(idVideo);
  }

  /** Cambia el preset de fecha y vuelve a pedir logs al backend. */
  cambiarRango(r: '7d' | '30d' | '90d' | 'all'): void {
    if (this.rangoActivo === r) return;
    this.rangoActivo = r;
    if (this.idVideo != null) this.cargarTodo(this.idVideo);
  }

  private rangoDesde(): string | null {
    const dias: Record<string, number | null> = { '7d': 7, '30d': 30, '90d': 90, 'all': null };
    const n = dias[this.rangoActivo];
    if (n == null) return null;
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  private cargarTodo(idVideo: number): void {
    this.cargando = true;
    this.cdr.markForCheck();

    const desde = this.rangoDesde();
    // En modo "grupo" pedimos los logs YA filtrados por el backend (que
    // además autoriza por rol del grupo). En modo global pedimos todos los
    // logs y dejamos que el desplegable filtre en cliente.
    const logs$ = this.fromGrupo && this.grupoIdCtx != null
      ? this.analiticasService.getLogsDelVideo(idVideo, this.grupoIdCtx, { desde })
      : this.analiticasService.getLogsDelVideo(idVideo, null, { desde });

    // Para los metadatos del vídeo (título, miniatura, duración):
    //  - Si vienes de un grupo, lo buscamos en los vídeos compartidos con
    //    ese grupo (el usuario puede no ser propietario).
    //  - Si vienes de "Mis vídeos", lo buscamos en obtenerMisVideos.
    const videos$: Observable<Video[]> = this.fromGrupo && this.grupoIdCtx != null
      ? this.videoService.obtenerVideosPorGrupo(this.grupoIdCtx)
      : this.videoService.obtenerMisVideos();

    combineLatest([videos$, logs$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([videos, logs]) => {
          const v = videos.find(x => x.idVideo === idVideo) ?? null;
          if (!v) {
            this.redirigirNoAutorizado();
            return;
          }
          this.video    = v;
          this.logs     = logs;
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 403 || err.status === 404) {
            this.redirigirNoAutorizado();
            return;
          }
          this.error    = 'No se pudieron cargar las analíticas del vídeo.';
          this.cargando = false;
          this.cdr.markForCheck();
        },
      });
  }

  private redirigirNoAutorizado(): void {
    if (this.grupoIdCtx != null) {
      this.router.navigate(['/mi-espacio/analiticas/grupo', this.grupoIdCtx], {
        queryParams: { aviso: 'sin-acceso-analiticas' },
      });
    } else {
      this.router.navigate(['/mi-espacio/analiticas'], {
        queryParams: { aviso: 'sin-acceso-analiticas' },
      });
    }
  }

  get backLink(): (string | number)[] {
    return this.grupoIdCtx != null
      ? ['/mi-espacio/analiticas/grupo', this.grupoIdCtx]
      : ['/mi-espacio/analiticas'];
  }

  get backLabel(): string {
    return this.fromGrupo ? 'Volver a analíticas del grupo' : 'Volver';
  }

  /** % de retención individual: segundos vistos en esta sesión / duración. */
  retencionPct(segundos: number | null): number {
    const dur = this.video?.duracion ?? 0;
    if (!segundos || dur <= 0) return 0;
    return Math.min(Math.round((segundos / dur) * 100), 100);
  }

  get logsFiltrados(): VideoLog[] {
    if (this.filtroGrupo === 'all')  return this.logs;
    if (this.filtroGrupo === 'none') return this.logs.filter(l => l.grupoId == null);
    return this.logs.filter(l => l.grupoId === this.filtroGrupo);
  }

  /**
   * Grupos disponibles en el desplegable. Combina los grupos a los que
   * pertenece el vídeo hoy con los que aparecen en logs huérfanos (vídeo ya
   * desvinculado del grupo o grupo eliminado).
   *
   * En modo "from=grupo" el desplegable se inhabilita en el HTML porque el
   * backend solo devuelve los logs de ese grupo y no tendría sentido
   * cambiar el filtro.
   */
  get gruposDisponibles(): GrupoRef[] {
    const fromVideo = this.video?.grupos ?? [];
    const fromLogs = new Map<number, string>();
    for (const l of this.logs) {
      if (l.grupoId != null && !fromLogs.has(l.grupoId)) {
        fromLogs.set(l.grupoId, l.grupoNombre ?? 'Group eliminado');
      }
    }
    fromVideo.forEach(g => fromLogs.delete(g.idGrupo));
    const huerfanos = [...fromLogs.entries()].map(([idGrupo, nombre]) => ({ idGrupo, nombre }));
    return [...fromVideo, ...huerfanos];
  }

  get hayLogsSinGrupo(): boolean {
    return this.logs.some(l => l.grupoId == null);
  }

  /** Opciones del desplegable de filtro de grupo para app-custom-select. */
  get filtroGrupoOptions(): SelectOption[] {
    const opts: SelectOption[] = [{ value: 'all', label: 'Todos los contextos' }];
    if (this.hayLogsSinGrupo) {
      opts.push({ value: 'none', label: 'Sin grupo (visualización directa)' });
    }
    for (const g of this.gruposDisponibles) {
      opts.push({ value: g.idGrupo, label: g.nombre });
    }
    return opts;
  }

  /** Nombre del grupo de contexto, para mostrar en la cabecera. */
  get nombreGrupoCtx(): string | null {
    if (this.grupoIdCtx == null) return null;
    const fromVideo = this.video?.grupos.find(g => g.idGrupo === this.grupoIdCtx);
    if (fromVideo) return fromVideo.nombre;
    const fromLog = this.logs.find(l => l.grupoId === this.grupoIdCtx);
    return fromLog?.grupoNombre ?? null;
  }

  get totalRegistros(): number {
    return this.logsFiltrados.length;
  }

  get espectadoresUnicos(): number {
    return new Set(this.logsFiltrados.map(l => l.idUsuario)).size;
  }

  get tiempoTotalVisto(): number {
    return this.logsFiltrados.reduce((s, l) => s + (l.segundosVistos ?? 0), 0);
  }

  /** Duración media por sesión — la métrica honesta, sin sumar sesiones distintas. */
  get duracionMediaSegundos(): number {
    const filas = this.logsFiltrados;
    if (!filas.length) return 0;
    return Math.round(filas.reduce((s, l) => s + (l.segundosVistos ?? 0), 0) / filas.length);
  }
}
