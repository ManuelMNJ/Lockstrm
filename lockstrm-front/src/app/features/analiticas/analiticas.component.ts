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
import { AnaliticasService, AnaliticasGlobales, VideoTop } from '../../core/services/analiticas.service';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';
import { ThumbnailSrcPipe } from '../../shared/pipes/thumbnail-src.pipe';

@Component({
  selector: 'app-analiticas',
  standalone: true,
  imports: [CommonModule, RouterLink, VideoDurationPipe, ThumbnailSrcPipe],
  templateUrl: './analiticas.component.html',
  styleUrl: './analiticas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnaliticasComponent implements OnInit {

  datos:    AnaliticasGlobales | null = null;
  cargando  = true;
  error     = '';

  private cdr        = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  constructor(private analiticasService: AnaliticasService) {}

  ngOnInit(): void {
    this.analiticasService.getGlobales()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.datos    = data;
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error    = 'No se pudieron cargar las analíticas. Recarga la página.';
          this.cargando = false;
          this.cdr.markForCheck();
        },
      });
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
}
