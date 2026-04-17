import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { GrupoService, Grupo, GrupoStats } from '../../core/services/grupo.service';
import { AuthService } from '../../core/services/auth.service';
import { DateLocalePipe } from '../../shared/pipes/date-locale.pipe';
import { InitialPipe } from '../../shared/pipes/initial.pipe';
import { ModalService } from '../../shared/services/modal.service';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, DateLocalePipe, InitialPipe],
  templateUrl: './grupos.component.html',
  styleUrl: './grupos.component.css',
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

  statsMap = new Map<number, GrupoStats>();

  @ViewChild('nombreGrupoInput') nombreGrupoInput?: ElementRef<HTMLInputElement>;

  private destroyRef = inject(DestroyRef);
  private cdr        = inject(ChangeDetectorRef);

  constructor(
    private grupoService:  GrupoService,
    private router:        Router,
    private authService:   AuthService,
    private cdr:           ChangeDetectorRef,
    private modalService:  ModalService,
  ) {}

  get currentUserId(): number | undefined {
    return this.authService.getUser()?.id;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.modalAbierto) this.cerrarModal();
  }

  ngOnInit(): void {
    this.cargarGrupos();
  }

  abrirDetalle(grupo: Grupo): void {
    this.router.navigate(['/mi-espacio/grupos', grupo.idGrupo]);
  }

  cargarGrupos(): void {
    this.cargando   = true;
    this.errorCarga = '';
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
          this.cdr.detectChanges();
          this.cargarEstadisticas([...creados, ...miembro]);
        },
        error: () => {
          this.errorCarga = 'No se pudo cargar la lista de grupos.';
          this.cargando   = false;
          this.cdr.detectChanges();
        },
      });

  private cargarEstadisticas(grupos: Grupo[]): void {
    if (!grupos.length) return;
    this.cargandoStats = true;

    this.videoService.obtenerMisVideos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          const map = new Map<number, GrupoStats>();
          stats.forEach(s => map.set(s.idGrupo, s));
          this.statsMap = map;
          this.cdr.detectChanges();
        },
        error: () => { /* stats opcionales */ },
      });
  }

    const requests = grupos.map(g =>
      this.grupoService.obtenerMiembros(g.idGrupo).pipe(
        map(miembros => ({ idGrupo: g.idGrupo, count: miembros.length })),
        catchError(() => of({ idGrupo: g.idGrupo, count: 0 })),
      )
    );
    if (!ok) return;

    this.grupoService.eliminarGrupo(idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.gruposCreados  = this.gruposCreados.filter(g => g.idGrupo !== idGrupo);
          this.gruposInvitado = this.gruposInvitado.filter(g => g.idGrupo !== idGrupo);
          this.statsMap.delete(idGrupo);
          this.cdr.detectChanges();
        },
        error: () => {},
      });
  }

  abrirModal(): void {
    this.modalAbierto     = true;
    this.nombreNuevoGrupo = '';
    this.estadoCreacion   = 'idle';
    this.errorCreacion    = '';
    setTimeout(() => this.nombreGrupoInput?.nativeElement.focus(), 50);
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  crearGrupo(): void {
    const nombre = this.nombreNuevoGrupo.trim();
    if (!nombre) return;

    this.estadoCreacion = 'loading';
    this.errorCreacion  = '';

    this.grupoService.crearGrupo(nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupo) => {
          this.misGrupos        = [...this.misGrupos, grupo];
          this.miembrosPerGrupo = new Map(this.miembrosPerGrupo).set(grupo.idGrupo, 1);
          this.videosPerGrupo   = new Map(this.videosPerGrupo).set(grupo.idGrupo, 0);
          this.cerrarModal();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.estadoCreacion = 'idle';
          this.errorCreacion  = err?.error?.error || 'Error al crear el grupo.';
          this.cerrarModal();
          this.cdr.detectChanges();
        },
      });
  }
}
