import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService, DashboardStats } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { VideoDurationPipe } from '../../shared/pipes/video-duration.pipe';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, VideoDurationPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {

  stats:    DashboardStats | null = null;
  cargando  = true;
  error     = '';

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
  }

  readonly skeletonItems = [1, 2, 3];
}
