import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, finalize, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { GroupService, Group, Member } from '../../../core/services/group.service';
import { VideoService, Video } from '../../../core/services/video.service';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { InitialPipe } from '../../../shared/pipes/initial.pipe';
import { DateLocalePipe } from '../../../shared/pipes/date-locale.pipe';
import { extractHttpErrorMessage } from '../../../shared/utils/error-utils';
import { GroupMembersComponent } from './group-members/group-members.component';
import { GroupVideosComponent } from './group-videos/group-videos.component';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, InitialPipe, DateLocalePipe, GroupMembersComponent, GroupVideosComponent],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDetailComponent implements OnInit {

  grupo: Group | null = null;
  miembros: Member[] = [];
  rolActual: string | null = null;

  videosGrupo: Video[] = [];
  misVideosDisponibles: Video[] = [];

  cargando = true;
  errorCarga = '';

  editandoNombre = false;
  nombreEditado = '';
  estadoRenombrar: 'idle' | 'loading' | 'error' = 'idle';
  errorRenombrar = '';

  confirmandoEliminarGrupo = false;
  estadoEliminarGrupo: 'idle' | 'loading' | 'error' = 'idle';
  errorEliminarGrupo = '';

  idGrupo!: number;
  readonly apiUrl = environment.apiUrl;
  subiendoImagen = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private grupoService: GroupService,
    private videoService: VideoService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  get currentUserId(): number | null {
    return this.authService.getUser()?.id ?? null;
  }

  get esSuperAdmin(): boolean {
    return this.rolActual === 'SUPER_ADMIN';
  }

  get esAdmin(): boolean {
    return this.rolActual === 'ADMIN' || this.rolActual === 'SUPER_ADMIN';
  }

  get puedeGestionarVideos(): boolean {
    return this.rolActual === 'SUPER_ADMIN' || this.rolActual === 'ADMIN' || this.rolActual === 'EDITOR';
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.idGrupo = Number(params.get('id'));
        this.grupo   = null;
        this.miembros = [];
        this.videosGrupo = [];
        this.misVideosDisponibles = [];
        this.rolActual = null;
        this.editandoNombre = false;
        this.confirmandoEliminarGrupo = false;
        this.cargarDatos();
      });
  }

  private cargarDatos(): void {
    this.cargando = true;
    this.errorCarga = '';

    this.grupoService.obtenerGrupoPorId(this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupo) => {
          this.grupo = grupo;
          this.nombreEditado = grupo.nombre;
          this.cargarMiembrosYVideos();
        },
        error: () => {
          this.errorCarga = 'No se pudo cargar la información del grupo.';
          this.cargando = false;
          this.cdr.markForCheck();
        },
      });
  }

  private cargarMiembrosYVideos(): void {
    this.grupoService.obtenerMiembros(this.idGrupo)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => { this.cargando = false; this.cdr.markForCheck(); })
      )
      .subscribe({
        next: (miembros) => {
          this.miembros = miembros;
          const propio = miembros.find(m => m.idUsuario === this.currentUserId);
          this.rolActual = propio?.rol ?? null;
          this.cdr.markForCheck();
          this.cargarVideos();
        },
        error: () => {
          this.errorCarga = 'No se pudieron cargar los miembros del grupo.';
          this.cdr.markForCheck();
        },
      });
  }

  private cargarVideos(): void {
    const videosGrupo$ = this.videoService.obtenerVideosPorGrupo(this.idGrupo);
    const misVideos$ = this.puedeGestionarVideos
      ? this.videoService.obtenerMisVideos().pipe(take(1))
      : of([] as Video[]);

    forkJoin({ videosGrupo: videosGrupo$, misVideos: misVideos$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ videosGrupo, misVideos }) => {
          this.videosGrupo = videosGrupo;
          this.misVideosDisponibles = misVideos.filter(
            v => !v.grupos.some(g => g.idGrupo === this.idGrupo)
          );
          this.cdr.markForCheck();
        },
        error: () => {
          this.cdr.markForCheck();
        },
      });
  }

  onMiembrosUpdated(miembros: Member[]): void {
    this.miembros = miembros;
    const propio = miembros.find(m => m.idUsuario === this.currentUserId);
    this.rolActual = propio?.rol ?? null;
    this.cdr.markForCheck();
  }

  onVideosChanged(state: { videosGrupo: Video[]; misVideosDisponibles: Video[] }): void {
    this.videosGrupo = state.videosGrupo;
    this.misVideosDisponibles = state.misVideosDisponibles;
    this.cdr.markForCheck();
  }

  activarEdicion(): void {
    this.editandoNombre  = true;
    this.estadoRenombrar = 'idle';
    this.errorRenombrar  = '';
    this.nombreEditado   = this.grupo?.nombre ?? '';
  }

  cancelarEdicion(): void {
    this.editandoNombre = false;
  }

  guardarNombre(): void {
    const nombre = this.nombreEditado.trim();
    if (!nombre || nombre === this.grupo?.nombre) {
      this.editandoNombre = false;
      this.cdr.markForCheck();
      return;
    }

    this.estadoRenombrar = 'loading';
    this.errorRenombrar  = '';
    this.cdr.markForCheck();

    this.grupoService.renombrarGrupo(this.idGrupo, nombre)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (g) => {
          this.grupo           = g;
          this.nombreEditado   = g.nombre;
          this.editandoNombre  = false;
          this.estadoRenombrar = 'idle';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.estadoRenombrar = 'error';
          this.errorRenombrar  = extractHttpErrorMessage(err, 'No se pudo actualizar el nombre.');
          this.cdr.markForCheck();
        },
      });
  }

  solicitarEliminarGrupo(): void {
    this.confirmandoEliminarGrupo = true;
    this.estadoEliminarGrupo      = 'idle';
    this.errorEliminarGrupo       = '';
  }

  cancelarEliminarGrupo(): void {
    this.confirmandoEliminarGrupo = false;
  }

  confirmarEliminarGrupo(): void {
    this.estadoEliminarGrupo = 'loading';
    this.cdr.markForCheck();

    this.grupoService.eliminarGrupo(this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/mi-espacio/grupos']),
        error: (err) => {
          this.estadoEliminarGrupo = 'error';
          this.errorEliminarGrupo  = extractHttpErrorMessage(err, 'No se pudo eliminar el grupo.');
          this.cdr.markForCheck();
        },
      });
  }

  volver(): void {
    this.router.navigate(['/mi-espacio/grupos']);
  }

  onImagenSeleccionada(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.grupo) return;
    this.subiendoImagen = true;
    this.grupoService.subirImagenGrupo(this.idGrupo, file)
      .pipe(take(1))
      .subscribe({
        next: ({ imagenUrl }) => {
          this.grupo = { ...this.grupo!, imagenUrl };
          this.subiendoImagen = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.subiendoImagen = false;
          this.cdr.markForCheck();
        },
      });
  }
}
