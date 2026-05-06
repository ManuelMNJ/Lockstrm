import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService, DashboardStats, ActivityItem } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';
import { ThumbnailSrcPipe } from '../../shared/pipes/thumbnail-src.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, VideoDurationPipe, ThumbnailSrcPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {

  stats:        DashboardStats | null = null;
  activityFeed: ActivityItem[]        = [];
  cargando      = true;
  error         = '';
  failedThumbs  = new Set<number>();

  onThumbError(idVideo: number): void {
    this.failedThumbs = new Set(this.failedThumbs).add(idVideo);
    this.cdr.markForCheck();
  }

  private cdr        = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  constructor(
    private dashboardService: DashboardService,
    readonly authService:     AuthService,
  ) {}

  ngOnInit(): void {
    this.dashboardService.getStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.stats    = data;
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error    = 'No se pudieron cargar las estadísticas. Recarga la página.';
          this.cargando = false;
          this.cdr.markForCheck();
        },
      });

    this.dashboardService.getActivity()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.activityFeed = data;
          this.cdr.markForCheck();
        },
      });
  }

  readonly skeletonItems = [1, 2, 3];

  relativeTime(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 60)   return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24)     return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d === 1)    return 'ayer';
    return `hace ${d} d`;
  }
}
