import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalyticsService, GroupVideoStats } from '../../../../core/services/analytics.service';
import { ThumbnailSrcPipe } from '../../../../shared/pipes/thumbnail-src.pipe';
import { VideoDurationPipe } from '../../../../shared/pipes/video-duration.pipe';

@Component({
  selector: 'app-group-analytics',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, ThumbnailSrcPipe, VideoDurationPipe],
  templateUrl: './group-analytics.component.html',
  styleUrls: ['../group-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupAnalyticsComponent implements OnInit {

  @Input() idGrupo!: number;
  @Input() esAdmin = false;

  analiticasGrupo: GroupVideoStats[] = [];
  cargandoAnaliticas = false;
  errorAnaliticas    = '';
  private analiticasCargadas = false;

  rangoActivo: '7d' | '30d' | '90d' | 'all' = 'all';

  readonly SPARK_W = 90;
  readonly SPARK_H = 24;

  failedThumbs = new Set<number>();

  private destroyRef = inject(DestroyRef);

  constructor(
    private analiticasService: AnalyticsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarAnaliticas();
  }

  refrescarAnaliticas(): void {
    this.analiticasCargadas = false;
    this.cargarAnaliticas();
  }

  cambiarRango(r: '7d' | '30d' | '90d' | 'all'): void {
    if (this.rangoActivo === r) return;
    this.rangoActivo = r;
    this.analiticasCargadas = false;
    this.cargarAnaliticas();
  }

  onThumbError(idVideo: number): void {
    this.failedThumbs = new Set(this.failedThumbs).add(idVideo);
    this.cdr.markForCheck();
  }

  sparklinePath(serie: number[]): string {
    const max = Math.max(...serie, 0);
    if (!serie.length || max === 0) return '';
    const w = this.SPARK_W;
    const h = this.SPARK_H - 2;
    const stepX = w / Math.max(serie.length - 1, 1);
    const points = serie.map((v, i) => {
      const x = i * stepX;
      const y = h - (v / max) * h + 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return 'M' + points.join(' L');
  }

  sparklineTitle(serie: number[]): string {
    const total = serie.reduce((a, b) => a + b, 0);
    const max   = Math.max(...serie, 0);
    return total === 0
      ? 'Sin visitas en los últimos 30 días'
      : `${total} visitas en los últimos 30 días · pico ${max} en un día`;
  }

  retencionPctVideo(stat: GroupVideoStats): number {
    return Math.round(stat.porcentajeCompletadoMedio ?? 0);
  }

  visitasPorUsuario(stat: GroupVideoStats): string {
    if (!stat.espectadoresUnicos) return '—';
    const ratio = stat.visitasTotales / stat.espectadoresUnicos;
    return ratio.toFixed(1);
  }

  get kpiVisitasTotales(): number {
    return this.analiticasGrupo.reduce((s, v) => s + v.visitasTotales, 0);
  }

  get kpiVideosConVistas(): number {
    return this.analiticasGrupo.filter(v => v.visitasTotales > 0).length;
  }

  get kpiTiempoTotalSegundos(): number {
    return this.analiticasGrupo.reduce((s, v) => s + v.tiempoTotalSegundos, 0);
  }

  get kpiRetencionMedia(): number {
    const totalVisitas = this.kpiVisitasTotales;
    if (!totalVisitas) return 0;
    const ponderado = this.analiticasGrupo
      .reduce((s, v) => s + v.porcentajeCompletadoMedio * v.visitasTotales, 0);
    return Math.round(ponderado / totalVisitas);
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

  private cargarAnaliticas(): void {
    if (!this.idGrupo) return;
    this.cargandoAnaliticas = true;
    this.errorAnaliticas    = '';
    this.cdr.markForCheck();

    const desde = this.rangoDesde();
    this.analiticasService.getAnaliticasDelGrupo(this.idGrupo, { desde })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.analiticasGrupo    = stats;
          this.analiticasCargadas = true;
          this.cargandoAnaliticas = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.errorAnaliticas = err?.status === 403
            ? 'No tienes permisos para ver las analíticas de este grupo.'
            : 'No se pudieron cargar las analíticas. Inténtalo de nuevo.';
          this.cargandoAnaliticas = false;
          this.cdr.markForCheck();
        },
      });
  }
}
