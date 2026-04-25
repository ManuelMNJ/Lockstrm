import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { A11yModule } from '@angular/cdk/a11y';
import { GrupoService, Grupo } from '../../core/services/grupo.service';
import { VideoService } from '../../core/services/video.service';
import { DateLocalePipe } from '../../shared/pipes/date-locale.pipe';
import { InitialPipe } from '../../shared/pipes/initial.pipe';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, DateLocalePipe, InitialPipe],
  templateUrl: './grupos.component.html',
  styleUrl: './grupos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GruposComponent implements OnInit {

  misGrupos: Grupo[]          = [];
  compartidosConmigo: Grupo[] = [];
  cargando = true;
  errorCarga = '';

  modalAbierto = false;
  nombreNuevoGrupo = '';
  estadoCreacion: 'idle' | 'loading' | 'error' = 'idle';
  errorCreacion = '';

  miembrosPerGrupo = new Map<number, number>();
  videosPerGrupo   = new Map<number, number>();

  @ViewChild('nombreGrupoInput') nombreGrupoInput?: ElementRef<HTMLInputElement>;

  private destroyRef = inject(DestroyRef);
  private cdr        = inject(ChangeDetectorRef);

  constructor(
    private grupoService: GrupoService,
    private videoService: VideoService,
    private router: Router,
  ) {}

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.modalAbierto) this.cerrarModal();
  }

  ngOnInit(): void {
    // Deferimos al siguiente tick para evitar NG0100 cuando la caché emite
    // síncronamente durante la CD inicial.
    queueMicrotask(() => this.cargarGrupos());
  }

  abrirDetalle(grupo: Grupo): void {
    this.router.navigate(['/mi-espacio/grupos', grupo.idGrupo]);
  }

  cargarGrupos(): void {
    this.cargando   = true;
    this.errorCarga = '';
    this.cdr.markForCheck();

    forkJoin({
      creados: this.grupoService.obtenerGruposCreados(),
      miembro: this.grupoService.obtenerGruposComoMiembro(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ creados, miembro }) => {
          this.misGrupos          = creados;
          this.compartidosConmigo = miembro;
          this.cargando           = false;
          this.cdr.markForCheck();
          this.cargarEstadisticas([...creados, ...miembro]);
        },
        error: () => {
          this.errorCarga = 'No se pudo cargar la lista de grupos.';
          this.cargando   = false;
          this.cdr.markForCheck();
        },
      });
  }

  private cargarEstadisticas(grupos: Grupo[]): void {
    if (!grupos.length) return;

    this.videoService.obtenerMisVideos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (videos) => {
          const countMap = new Map<number, number>();
          videos.forEach(v => {
            const idGrupo = v.grupo?.idGrupo;
            if (idGrupo) {
              countMap.set(idGrupo, (countMap.get(idGrupo) ?? 0) + 1);
            }
          });
          this.videosPerGrupo = countMap;
          this.cdr.markForCheck();
        },
        error: () => { /* stats opcionales */ },
      });

    const requests = grupos.map(g =>
      this.grupoService.obtenerMiembros(g.idGrupo).pipe(
        map(miembros => ({ idGrupo: g.idGrupo, count: miembros.length })),
        catchError(() => of({ idGrupo: g.idGrupo, count: 0 })),
      )
    );

    forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          const countMap = new Map<number, number>();
          results.forEach(r => countMap.set(r.idGrupo, r.count));
          this.miembrosPerGrupo = countMap;
          this.cdr.markForCheck();
        },
      });
  }

  abrirModal(): void {
    this.modalAbierto     = true;
    this.nombreNuevoGrupo = '';
    this.estadoCreacion   = 'idle';
    this.errorCreacion    = '';
    this.cdr.markForCheck();
    setTimeout(() => this.nombreGrupoInput?.nativeElement.focus(), 50);
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.cdr.markForCheck();
  }

  crearGrupo(): void {
    const nombre = this.nombreNuevoGrupo.trim();
    if (!nombre) return;

    this.estadoCreacion = 'loading';
    this.errorCreacion  = '';
    this.cdr.markForCheck();

    this.grupoService.crearGrupo(nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupo) => {
          this.estadoCreacion = 'idle';
          this.cerrarModal();
          this.router.navigate(['/mi-espacio/grupos', grupo.idGrupo]);
        },
        error: (err) => {
          this.estadoCreacion = 'error';
          this.errorCreacion  = err?.error?.error || 'Error al crear el grupo.';
          this.cdr.markForCheck();
        },
      });
  }

  getMiembros(idGrupo: number): number | null {
    return this.miembrosPerGrupo.get(idGrupo) ?? null;
  }

  getVideos(idGrupo: number): number | null {
    return this.videosPerGrupo.get(idGrupo) ?? null;
  }
}
