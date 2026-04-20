import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { VideoService, Video } from '../../../core/services/video.service';
import { AnaliticasService, VideoLog } from '../../../core/services/analiticas.service';
import { VideoDurationPipe } from '../../../shared/pipes/video-duration.pipe';

@Component({
  selector: 'app-analiticas-video',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, VideoDurationPipe],
  templateUrl: './analiticas-video.component.html',
  styleUrl: './analiticas-video.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnaliticasVideoComponent implements OnInit {

  video:     Video | null = null;
  logs:      VideoLog[]   = [];
  cargando   = true;
  error      = '';

  private readonly route             = inject(ActivatedRoute);
  private readonly videoService      = inject(VideoService);
  private readonly analiticasService = inject(AnaliticasService);
  private readonly cdr               = inject(ChangeDetectorRef);
  private readonly destroyRef        = inject(DestroyRef);

  ngOnInit(): void {
    const idVideo = Number(this.route.snapshot.paramMap.get('idVideo'));
    if (!idVideo) {
      this.error    = 'Vídeo no válido.';
      this.cargando = false;
      return;
    }

    combineLatest([
      this.videoService.obtenerMisVideos(),
      this.analiticasService.getLogsDelVideo(idVideo),
    ]).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([videos, logs]) => {
          this.video    = videos.find(v => v.idVideo === idVideo) ?? null;
          this.logs     = logs;
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error    = 'No se pudieron cargar las analíticas del vídeo.';
          this.cargando = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** % de retención individual: segundos vistos en esta sesión / duración. */
  retencionPct(segundos: number | null): number {
    const dur = this.video?.duracion ?? 0;
    if (!segundos || dur <= 0) return 0;
    return Math.min(Math.round((segundos / dur) * 100), 100);
  }

  /** Totales agregados mostrados en la cabecera. */
  get totalRegistros(): number {
    return this.logs.length;
  }

  get espectadoresUnicos(): number {
    return new Set(this.logs.map(l => l.email)).size;
  }

  get tiempoTotalVisto(): number {
    return this.logs.reduce((s, l) => s + (l.segundosVistos ?? 0), 0);
  }
}
