import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VideoService, Video } from '../../core/services/video.service';
import { GrupoService, Grupo } from '../../core/services/grupo.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {

  totalVideos  = 0;
  totalGrupos  = 0;
  videosRecientes: Video[] = [];
  cargando = true;

  private destroyRef = inject(DestroyRef);

  constructor(
    private videoService: VideoService,
    private grupoService: GrupoService,
    readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.videoService.obtenerVideos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (videos) => {
          this.totalVideos     = videos.length;
          this.videosRecientes = videos.slice(0, 4);
          this.cargando        = false;
        },
        error: () => { this.cargando = false; }
      });

    this.grupoService.obtenerMisGrupos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupos) => { this.totalGrupos = grupos.length; },
      });
  }

  formatearDuracion(segundos: number | null | undefined): string {
    if (segundos == null || segundos <= 0) return '—';
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
