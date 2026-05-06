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
import { UI_TIMINGS } from '../../shared/utils/ui-constants';
import { A11yModule } from '@angular/cdk/a11y';
import { GroupService, Group } from '../../core/services/group.service';
import { VideoService } from '../../core/services/video.service';
import { DateLocalePipe } from '../../shared/pipes/date-locale.pipe';
import { InitialPipe } from '../../shared/pipes/initial.pipe';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule, A11yModule, DateLocalePipe, InitialPipe],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsComponent implements OnInit {

  readonly apiUrl = environment.apiUrl;

  misGrupos: Group[]          = [];
  compartidosConmigo: Group[] = [];
  cargando = true;
  errorCarga = '';

  modalAbierto = false;
  nombreNuevoGrupo = '';
  estadoCreacion: 'idle' | 'loading' | 'error' = 'idle';
  errorCreacion = '';

  miembrosPerGrupo = new Map<number, number>();
  videosPerGrupo   = new Map<number, number>();

  readonly tamanioPagina = 8;

  sortMisGrupos:    { campo: 'nombre' | 'fechaCreacion' | 'miembros' | 'videos'; dir: 'asc' | 'desc' } = { campo: 'fechaCreacion', dir: 'desc' };
  sortCompartidos:  { campo: 'nombre' | 'fechaCreacion' | 'miembros' | 'videos'; dir: 'asc' | 'desc' } = { campo: 'fechaCreacion', dir: 'desc' };
  paginaMisGrupos   = 1;
  paginaCompartidos = 1;

  @ViewChild('nombreGrupoInput') nombreGrupoInput?: ElementRef<HTMLInputElement>;

  private destroyRef = inject(DestroyRef);
  private cdr        = inject(ChangeDetectorRef);

  constructor(
    private grupoService: GroupService,
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

  abrirDetalle(grupo: Group): void {
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

  private cargarEstadisticas(grupos: Group[]): void {
    if (!grupos.length) return;

    this.videoService.obtenerMisVideos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (videos) => {
          // Un vídeo puede pertenecer a varios grupos (N:M); cada uno suma +1.
          const countMap = new Map<number, number>();
          videos.forEach(v => {
            v.grupos.forEach(({ idGrupo }) => {
              countMap.set(idGrupo, (countMap.get(idGrupo) ?? 0) + 1);
            });
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
    setTimeout(() => this.nombreGrupoInput?.nativeElement.focus(), UI_TIMINGS.DOM_FOCUS_DELAY_MS);
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

  // ── Ordenación ──────────────────────────────────────────────────────
  private ordenar(lista: Group[], sort: typeof this.sortMisGrupos): Group[] {
    return [...lista].sort((a, b) => {
      let cmp = 0;
      if (sort.campo === 'nombre') {
        cmp = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
      } else if (sort.campo === 'fechaCreacion') {
        cmp = new Date(a.fechaCreacion ?? 0).getTime() - new Date(b.fechaCreacion ?? 0).getTime();
      } else if (sort.campo === 'miembros') {
        cmp = (this.miembrosPerGrupo.get(a.idGrupo) ?? 0) - (this.miembrosPerGrupo.get(b.idGrupo) ?? 0);
      } else {
        cmp = (this.videosPerGrupo.get(a.idGrupo) ?? 0) - (this.videosPerGrupo.get(b.idGrupo) ?? 0);
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }

  cambiarOrden(seccion: 'mis' | 'compartidos', campo: typeof this.sortMisGrupos['campo']): void {
    const sort = seccion === 'mis' ? this.sortMisGrupos : this.sortCompartidos;
    if (sort.campo === campo) {
      sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sort.campo = campo;
      sort.dir   = campo === 'nombre' ? 'asc' : 'desc';
    }
    if (seccion === 'mis') { this.paginaMisGrupos = 1; }
    else                   { this.paginaCompartidos = 1; }
    this.cdr.markForCheck();
  }

  // ── Paginación ───────────────────────────────────────────────────────
  private paginar(lista: Group[], pagina: number): Group[] {
    const inicio = (pagina - 1) * this.tamanioPagina;
    return lista.slice(inicio, inicio + this.tamanioPagina);
  }

  get misGruposOrdenados(): Group[] { return this.ordenar(this.misGrupos, this.sortMisGrupos); }
  get compartidosOrdenados(): Group[] { return this.ordenar(this.compartidosConmigo, this.sortCompartidos); }

  get misGruposPaginados(): Group[]   { return this.paginar(this.misGruposOrdenados, this.paginaMisGrupos); }
  get compartidosPaginados(): Group[] { return this.paginar(this.compartidosOrdenados, this.paginaCompartidos); }

  get totalPaginasMis(): number   { return Math.ceil(this.misGrupos.length / this.tamanioPagina) || 1; }
  get totalPaginasComp(): number  { return Math.ceil(this.compartidosConmigo.length / this.tamanioPagina) || 1; }

  irPagina(seccion: 'mis' | 'compartidos', pagina: number): void {
    if (seccion === 'mis')  { this.paginaMisGrupos   = pagina; }
    else                    { this.paginaCompartidos  = pagina; }
    this.cdr.markForCheck();
  }

  rangosPaginas(total: number): number[] {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
}
