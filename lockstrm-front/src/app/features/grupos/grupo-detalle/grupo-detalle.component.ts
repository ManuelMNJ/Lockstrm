import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, finalize, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { GrupoService, Grupo, Miembro } from '../../../core/services/grupo.service';
import { VideoService, Video, VideoVistaEstadistica } from '../../../core/services/video.service';
import { AnaliticasService, GrupoVideoStats } from '../../../core/services/analiticas.service';
import { AuthService } from '../../../core/services/auth.service';
import { InitialPipe } from '../../../shared/pipes/initial.pipe';
import { VideoDurationPipe } from '../../../shared/pipes/video-duration.pipe';
import { VideoPlayerComponent } from '../../videos/video-player/video-player.component';
import { extractHttpErrorMessage } from '../../../shared/utils/error-utils';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [FormsModule, InitialPipe, VideoDurationPipe, VideoPlayerComponent],
  templateUrl: './grupo-detalle.component.html',
  styleUrl: './grupo-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrupoDetalleComponent implements OnInit {

  grupo: Grupo | null = null;
  miembros: Miembro[] = [];

  rolActual: string | null = null;
  rolesDisponiblesParaAsignar: string[] = []; // Fix para el NG0100
  cambiandoRoles = new Set<number>();
  errorCambioRol = '';

  videosGrupo: Video[] = [];
  misVideosDisponibles: Video[] = [];
  idVideoAAnadir: number | null = null;
  estadoAnadirVideo: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  errorAnadirVideo = '';
  quitandoVideos = new Set<number>();
  videoReproduciendose: Video | null = null;

  cargando = true;
  errorCarga = '';

  identificadorNuevoMiembro = '';
  estadoAnadir: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  errorAnadir = '';

  editandoNombre = false;
  nombreEditado = '';
  estadoRenombrar: 'idle' | 'loading' | 'error' = 'idle';
  errorRenombrar = '';

  eliminandoMiembros = new Set<number>();
  errorEliminarMiembro = '';

  confirmandoEliminarGrupo = false;
  estadoEliminarGrupo: 'idle' | 'loading' | 'error' = 'idle';
  errorEliminarGrupo = '';

  errorVideos = '';

  criterioOrden: string = 'fechaDesc';

  get videosGrupoOrdenados(): Video[] {
    return [...this.videosGrupo].sort((a, b) => {
      switch (this.criterioOrden) {
        case 'fechaDesc':    return new Date(b.fechaSubida ?? 0).getTime() - new Date(a.fechaSubida ?? 0).getTime();
        case 'fechaAsc':     return new Date(a.fechaSubida ?? 0).getTime() - new Date(b.fechaSubida ?? 0).getTime();
        case 'duracionDesc': return (b.duracion ?? 0) - (a.duracion ?? 0);
        case 'duracionAsc':  return (a.duracion ?? 0) - (b.duracion ?? 0);
        case 'nombreAsc':    return a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' });
        default:             return 0;
      }
    });
  }

  onCambioOrden(valor: string): void {
    this.criterioOrden = valor;
    this.cdr.markForCheck();
  }

  videoStats: Video | null = null;
  estadisticas: VideoVistaEstadistica[] = [];
  cargandoStats = false;
  errorStats = '';

  /**
   * Pestaña activa del detalle del grupo. "resumen" muestra el layout
   * existente (miembros + vídeos); "analiticas" abre el panel B2B con los
   * agregados por vídeo en el contexto de este grupo. La pestaña de
   * analíticas solo está accesible para roles EDITOR+.
   */
  pestanaActiva: 'resumen' | 'analiticas' = 'resumen';

  analiticasGrupo: GrupoVideoStats[] = [];
  cargandoAnaliticas = false;
  errorAnaliticas = '';
  /** Evita refetch en cada cambio de pestaña; primera apertura carga, sucesivas no. */
  private analiticasCargadas = false;

  // Público porque el template lo enlaza a [grupoId] del <app-video-player>
  // para que el heartbeat lleve el contexto de grupo a la analítica.
  idGrupo!: number;
  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private grupoService: GrupoService,
    protected videoService: VideoService,
    private analiticasService: AnaliticasService,
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

  get puedeGestionarRoles(): boolean {
    return this.esAdmin;
  }

  get puedeGestionarVideos(): boolean {
    return this.rolActual === 'SUPER_ADMIN' || this.rolActual === 'ADMIN' || this.rolActual === 'EDITOR';
  }

  puedeActuarSobreRol(rolObjetivo: string): boolean {
    if (this.esSuperAdmin) return true;
    if (this.rolActual === 'ADMIN') {
      return rolObjetivo !== 'SUPER_ADMIN' && rolObjetivo !== 'ADMIN';
    }
    return false;
  }

  puedeQuitarVideo(video: Video): boolean {
    if (this.esAdmin) return true;
    // Si es editor, en el HTML permitimos pulsar, pero el backend validará que sea suyo
    return this.rolActual === 'EDITOR'; 
  }

  private addEliminando(idUsuario: number): void {
    this.eliminandoMiembros = new Set(this.eliminandoMiembros).add(idUsuario);
  }

  private removeEliminando(idUsuario: number): void {
    const next = new Set(this.eliminandoMiembros);
    next.delete(idUsuario);
    this.eliminandoMiembros = next;
  }

  ngOnInit(): void {
    this.idGrupo = Number(this.route.snapshot.paramMap.get('id'));
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando = true;
    this.errorCarga = '';

    // Primero obtenemos el grupo
    this.grupoService.obtenerGrupoPorId(this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grupo) => {
          this.grupo = grupo;
          this.nombreEditado = grupo.nombre;
          this.cargarMiembrosYVideos(); // Encadenamos para evitar Race Conditions
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
          
          // Pre-calculamos los roles disponibles para evitar NG0100
          if (this.esSuperAdmin) {
            this.rolesDisponiblesParaAsignar = ['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'MIEMBRO'];
          } else if (this.rolActual === 'ADMIN') {
            this.rolesDisponiblesParaAsignar = ['EDITOR', 'MIEMBRO'];
          } else {
            this.rolesDisponiblesParaAsignar = [];
          }

          this.cdr.markForCheck();
          // Ahora que sabemos el rol con seguridad, cargamos los vídeos
          this.cargarVideos();
        },
        error: () => {
          this.errorCarga = 'No se pudieron cargar los miembros del grupo.';
          this.cdr.markForCheck();
        },
      });
  }

  private cargarVideos(): void {
    // 1. LA LISTA DEL GRUPO: endpoint dedicado — devuelve todos los vídeos del grupo
    //    independientemente de quién los subió (funciona para miembros, editores y admins).
    const videosGrupo$ = this.videoService.obtenerVideosPorGrupo(this.idGrupo);

    // 2. EL DESPLEGABLE "añadir vídeo existente": solo tiene sentido si el usuario puede gestionar.
    //    obtenerMisVideos() devuelve un BehaviorSubject vivo; con take(1) lo convertimos en
    //    un stream que completa tras la primera emisión — imprescindible para forkJoin.
    const misVideos$ = this.puedeGestionarVideos
      ? this.videoService.obtenerMisVideos().pipe(take(1))
      : of([] as Video[]);

    forkJoin({ videosGrupo: videosGrupo$, misVideos: misVideos$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ videosGrupo, misVideos }) => {
          this.videosGrupo = videosGrupo;
          // Excluimos del desplegable "añadir vídeo existente" los que ya están
          // en este grupo. Como un vídeo puede pertenecer a varios, comprobamos
          // si el grupo actual está en su lista, no la igualdad estricta.
          this.misVideosDisponibles = misVideos.filter(
            v => !v.grupos.some(g => g.idGrupo === this.idGrupo)
          );
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorVideos = 'No se pudieron cargar los vídeos del grupo.';
          this.cdr.markForCheck();
        },
      });
  }

  aniadirVideoExistente(): void {
    if (this.idVideoAAnadir == null) return;
    const video = this.misVideosDisponibles.find(v => v.idVideo === this.idVideoAAnadir);
    if (!video) return;

    this.estadoAnadirVideo = 'loading';
    this.errorAnadirVideo  = '';
    this.cdr.markForCheck();

    // Añadir = unión del set actual + este grupo. NO sustituimos los grupos
    // del vídeo; conservamos cualquier otra pertenencia previa.
    const idGruposSet = new Set(video.grupos.map(g => g.idGrupo));
    idGruposSet.add(this.idGrupo);
    this.videoService.editarVideo(video.idVideo, video.titulo, [...idGruposSet])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.idVideoAAnadir    = null;
          this.estadoAnadirVideo = 'success';
          this.cdr.markForCheck();
          this.cargarVideos();
          setTimeout(() => { this.estadoAnadirVideo = 'idle'; this.cdr.markForCheck(); }, 3000);
        },
        error: (err) => {
          this.estadoAnadirVideo = 'error';
          this.errorAnadirVideo  = extractHttpErrorMessage(err, 'No se pudo añadir el vídeo.');
          this.cdr.markForCheck();
        },
      });
  }

  quitarVideoDelGrupo(video: Video): void {
    this.quitandoVideos = new Set(this.quitandoVideos).add(video.idVideo);

    // Quitar = mismos grupos menos el actual. Si el vídeo estaba en otros
    // grupos, los conservamos: solo desvinculamos del grupo en el que estamos.
    const nuevosGrupos = video.grupos.filter(g => g.idGrupo !== this.idGrupo);

    this.videoService.editarVideo(video.idVideo, video.titulo, nuevosGrupos.map(g => g.idGrupo))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const next = new Set(this.quitandoVideos);
          next.delete(video.idVideo);
          this.quitandoVideos = next;
          this.videosGrupo = this.videosGrupo.filter(v => v.idVideo !== video.idVideo);
          // Solo lo devolvemos al desplegable si no tiene ya otra pertenencia
          // que lo excluya de la lista (en realidad sí lo devolvemos siempre:
          // si quedó sin grupos, vuelve a estar disponible para añadir aquí o
          // a otro; si quedó con otros grupos, el filtro de `cargarVideos`
          // ya lo dejaría dentro porque este grupo ya no está en su lista).
          this.misVideosDisponibles = [...this.misVideosDisponibles, { ...video, grupos: nuevosGrupos }];
          this.cdr.markForCheck();
        },
        error: () => {
          const next = new Set(this.quitandoVideos);
          next.delete(video.idVideo);
          this.quitandoVideos = next;
          this.cdr.markForCheck();
        },
      });
  }

  aniadirMiembro(): void {
    const identificador = this.identificadorNuevoMiembro.trim();
    if (!identificador) return;

    this.estadoAnadir = 'loading';
    this.errorAnadir  = '';
    this.cdr.markForCheck();

    this.grupoService.aniadirMiembro(this.idGrupo, identificador)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.identificadorNuevoMiembro = '';
          this.estadoAnadir = 'success';
          this.cdr.markForCheck();
          this.cargarMiembrosYVideos();
          setTimeout(() => { this.estadoAnadir = 'idle'; this.cdr.markForCheck(); }, 3000);
        },
        error: (err) => {
          this.estadoAnadir = 'error';
          this.errorAnadir  = extractHttpErrorMessage(err, 'No se pudo añadir el miembro.');
          this.cdr.markForCheck();
        },
      });
  }

  eliminarMiembro(miembro: Miembro): void {
    this.addEliminando(miembro.idUsuario);
    this.errorEliminarMiembro = '';
    this.cdr.markForCheck();

    this.grupoService.eliminarMiembro(this.idGrupo, miembro.idUsuario)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.miembros = this.miembros.filter(m => m.idUsuario !== miembro.idUsuario);
          this.removeEliminando(miembro.idUsuario);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.removeEliminando(miembro.idUsuario);
          this.errorEliminarMiembro = extractHttpErrorMessage(err, 'No se pudo eliminar el miembro.');
          this.cdr.markForCheck();
        },
      });
  }

  cambiarRolMiembro(miembro: Miembro, nuevoRol: string): void {
    if (!nuevoRol || nuevoRol === miembro.rol) return;

    this.cambiandoRoles = new Set(this.cambiandoRoles).add(miembro.idUsuario);
    this.errorCambioRol = '';
    this.cdr.markForCheck();

    this.grupoService.cambiarRolMiembro(this.idGrupo, miembro.idUsuario, nuevoRol)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.miembros = this.miembros.map(m =>
            m.idUsuario === miembro.idUsuario ? { ...m, rol: nuevoRol } : m
          );
          const next = new Set(this.cambiandoRoles);
          next.delete(miembro.idUsuario);
          this.cambiandoRoles = next;
          this.cdr.markForCheck();
        },
        error: (err) => {
          const next = new Set(this.cambiandoRoles);
          next.delete(miembro.idUsuario);
          this.cambiandoRoles = next;
          this.errorCambioRol = extractHttpErrorMessage(err, 'No se pudo cambiar el rol.');
          this.cdr.markForCheck();
        },
      });
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.videoReproduciendose) { this.cerrarReproductor(); return; }
    if (this.videoStats)           { this.cerrarStats();       return; }
  }

  abrirStats(video: Video): void {
    this.videoStats      = video;
    this.estadisticas    = [];
    this.cargandoStats   = true;
    this.errorStats      = '';
    this.cdr.markForCheck();

    this.videoService.obtenerEstadisticas(video.idVideo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.estadisticas  = data;
          this.cargandoStats = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorStats    = 'No se pudieron cargar las estadísticas.';
          this.cargandoStats = false;
          this.cdr.markForCheck();
        },
      });
  }

  cerrarStats(): void {
    this.videoStats = null;
    this.cdr.markForCheck();
  }

  verVideo(video: Video): void {
    this.videoReproduciendose = video;
    this.cdr.markForCheck();
  }

  cerrarReproductor(): void {
    this.videoReproduciendose = null;
    this.cdr.markForCheck();
  }

  onHeartbeat(payload: { currentTime: number; sessionId: string; grupoId: number | null }): void {
    const idVideo = this.videoReproduciendose?.idVideo;
    if (!idVideo) return;
    this.videoService.registrarHeartbeat(idVideo, payload.currentTime, payload.sessionId, payload.grupoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => {} });
  }

  /**
   * Cambia entre las pestañas del detalle. La carga de analíticas es
   * perezosa: solo se dispara la primera vez que el usuario entra en la
   * pestaña, no en cada toggle. Si quiere refrescar, puede usar
   * {@link refrescarAnaliticas}.
   */
  cambiarPestana(p: 'resumen' | 'analiticas'): void {
    this.pestanaActiva = p;
    if (p === 'analiticas' && !this.analiticasCargadas) {
      this.cargarAnaliticas();
    }
    this.cdr.markForCheck();
  }

  refrescarAnaliticas(): void {
    this.analiticasCargadas = false;
    this.cargarAnaliticas();
  }

  private cargarAnaliticas(): void {
    if (!this.idGrupo) return;
    this.cargandoAnaliticas = true;
    this.errorAnaliticas    = '';
    this.cdr.markForCheck();

    this.analiticasService.getAnaliticasDelGrupo(this.idGrupo)
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

  /** % de retención agregado del vídeo en este grupo. */
  retencionPctVideo(stat: GrupoVideoStats): number {
    if (!stat.duracion || stat.duracion <= 0 || !stat.espectadoresUnicos) return 0;
    // Promedio de segundos por espectador / duración del vídeo.
    const segundosMediosPorUsuario = stat.tiempoTotalSegundos / stat.espectadoresUnicos;
    return Math.min(Math.round((segundosMediosPorUsuario / stat.duracion) * 100), 100);
  }

  volver(): void {
    this.router.navigate(['/mi-espacio/grupos']);
  }

}