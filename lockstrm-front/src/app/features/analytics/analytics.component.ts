import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AnalyticsService, GlobalAnalytics, GroupVideoStats, VideoTop } from '../../core/services/analytics.service';
import { GroupService, Group } from '../../core/services/group.service';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';
import { ThumbnailSrcPipe } from '../../shared/pipes/thumbnail-src.pipe';
import { Paginator } from '../../shared/utils/paginator';

interface GrupoResumen {
  idGrupo:        number;
  nombre:         string;
  visitasTotales: number;
  videosActivos:  number;
  retencionMedia: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink, VideoDurationPipe, ThumbnailSrcPipe],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent implements OnInit {

  datos:         GlobalAnalytics | null = null;
  cargando       = true;
  error          = '';
  failedThumbs   = new Set<number>();

  gruposResumen:  GrupoResumen[] = [];
  cargandoGrupos = true;
  errorGrupos    = '';

  pTopVideos = new Paginator<VideoTop>(10);
  pGrupos    = new Paginator<GrupoResumen>(10);

  onThumbError(idVideo: number): void {
    this.failedThumbs = new Set(this.failedThumbs).add(idVideo);
    this.cdr.markForCheck();
  }

  private cdr          = inject(ChangeDetectorRef);
  private destroyRef   = inject(DestroyRef);
  private grupoService = inject(GroupService);

  constructor(private analiticasService: AnalyticsService) {}

  ngOnInit(): void {
    this.analiticasService.getGlobales()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.datos    = data;
          this.pTopVideos.setItems(data.topVideos ?? []);
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error    = 'No se pudieron cargar las analíticas. Recarga la página.';
          this.cargando = false;
          this.cdr.markForCheck();
        },
      });

    this.grupoService.obtenerMisGrupos().pipe(
      switchMap(grupos => {
        if (!grupos.length) return of([]);
        return forkJoin(
          grupos.map(g =>
            this.analiticasService.getAnaliticasDelGrupo(g.idGrupo).pipe(
              map(stats => this.calcularResumen(g, stats)),
              catchError(() => of(null))
            )
          )
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: resultados => {
        this.gruposResumen = (resultados as (GrupoResumen | null)[])
          .filter((r): r is GrupoResumen => r != null)
          .sort((a, b) => b.visitasTotales - a.visitasTotales);
        this.pGrupos.setItems(this.gruposResumen);
        this.cargandoGrupos = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorGrupos    = 'No se pudieron cargar las analíticas de grupos.';
        this.cargandoGrupos = false;
        this.cdr.markForCheck();
      },
    });
  }

  private calcularResumen(grupo: Group, stats: GroupVideoStats[]): GrupoResumen {
    const visitasTotales = stats.reduce((s, v) => s + v.visitasTotales, 0);
    const videosActivos  = stats.filter(v => v.visitasTotales > 0).length;
    const retencionMedia = visitasTotales
      ? Math.round(stats.reduce((s, v) => s + v.porcentajeCompletadoMedio * v.visitasTotales, 0) / visitasTotales)
      : 0;
    return { idGrupo: grupo.idGrupo, nombre: grupo.nombre, visitasTotales, videosActivos, retencionMedia };
  }

  /** Retención redondeada a un decimal, o null si no hay datos. */
  get retencionFormateada(): string {
    const r = this.datos?.retencionMediaGlobal;
    if (r == null) return '—';
    return `${Math.min(r, 100).toFixed(1)}%`;
  }

  /** Anchura de la barra de retención (0–100). */
  get retencionBarra(): number {
    const r = this.datos?.retencionMediaGlobal;
    return r != null ? Math.min(Math.max(r, 0), 100) : 0;
  }

  /** Máximo de vistas entre los top vídeos (para calcular barras relativas). */
  get maxVistas(): number {
    return this.datos?.topVideos?.reduce((m, v) => Math.max(m, v.vistas), 1) ?? 1;
  }

  vistasPct(video: VideoTop): number {
    return Math.round((video.vistas / this.maxVistas) * 100);
  }

  readonly skeletonItems = [1, 2, 3];

  globalIdx(localIdx: number, paginator: Paginator<any>): number {
    return (paginator.page - 1) * paginator.pageSize + localIdx;
  }

  irPaginaTopVideos(p: number): void { this.pTopVideos.goToPage(p); this.cdr.markForCheck(); }
  irPaginaGrupos(p: number):    void { this.pGrupos.goToPage(p);    this.cdr.markForCheck(); }
}
