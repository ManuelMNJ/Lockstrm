import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormsModule } from '@angular/forms';
import { GroupService, Member } from '../../../../core/services/group.service';
import { ThumbnailSrcPipe } from '../../../../shared/pipes/thumbnail-src.pipe';
import { extractHttpErrorMessage } from '../../../../shared/utils/error-utils';
import { UI_TIMINGS } from '../../../../shared/utils/ui-constants';
import { CustomSelectComponent, SelectOption } from '../../../../shared/components/custom-select/custom-select.component';

@Component({
  selector: 'app-group-members',
  standalone: true,
  imports: [FormsModule, ThumbnailSrcPipe, CustomSelectComponent],
  templateUrl: './group-members.component.html',
  styleUrls: ['../group-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupMembersComponent implements OnChanges {

  @Input() idGrupo!: number;
  @Input() rolActual: string | null = null;
  @Input() currentUserId: number | null = null;
  @Input() miembros: Member[] = [];

  @Output() miembrosUpdated = new EventEmitter<Member[]>();

  identificadorNuevoMiembro = '';
  estadoAnadir: 'idle' | 'loading' | 'success' | 'error' = 'idle';
  errorAnadir = '';

  eliminandoMiembros = new Set<number>();
  errorEliminarMiembro = '';

  cambiandoRoles = new Set<number>();
  errorCambioRol = '';

  pendingRolMiembro: Member | null = null;
  pendingRolNuevo   = '';
  confirmarRolVisible = false;

  rolesDisponiblesParaAsignar: string[] = [];

  private destroyRef = inject(DestroyRef);

  constructor(
    private grupoService: GroupService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(): void {
    // Recalculamos los roles disponibles cuando cambia rolActual
    if (this.esSuperAdmin) {
      this.rolesDisponiblesParaAsignar = ['ADMIN', 'EDITOR', 'MIEMBRO'];
    } else if (this.rolActual === 'ADMIN') {
      this.rolesDisponiblesParaAsignar = ['EDITOR', 'MIEMBRO'];
    } else {
      this.rolesDisponiblesParaAsignar = [];
    }
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

  get rolOptionsParaAsignar(): SelectOption[] {
    return this.rolesDisponiblesParaAsignar.map(r => ({ value: r, label: r }));
  }

  puedeActuarSobreRol(rolObjetivo: string): boolean {
    if (this.esSuperAdmin) return true;
    if (this.rolActual === 'ADMIN') {
      return rolObjetivo !== 'SUPER_ADMIN' && rolObjetivo !== 'ADMIN';
    }
    return false;
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
          this.recargarMiembros();
          setTimeout(() => { this.estadoAnadir = 'idle'; this.cdr.markForCheck(); }, UI_TIMINGS.FEEDBACK_SUCCESS_MS);
        },
        error: (err) => {
          this.estadoAnadir = 'error';
          this.errorAnadir  = extractHttpErrorMessage(err, 'No se pudo añadir el miembro.');
          this.cdr.markForCheck();
        },
      });
  }

  eliminarMiembro(miembro: Member): void {
    this.eliminandoMiembros = new Set(this.eliminandoMiembros).add(miembro.idUsuario);
    this.errorEliminarMiembro = '';
    this.cdr.markForCheck();

    this.grupoService.eliminarMiembro(this.idGrupo, miembro.idUsuario)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const next = new Set(this.eliminandoMiembros);
          next.delete(miembro.idUsuario);
          this.eliminandoMiembros = next;
          const updated = this.miembros.filter(m => m.idUsuario !== miembro.idUsuario);
          this.miembrosUpdated.emit(updated);
          this.cdr.markForCheck();
        },
        error: (err) => {
          const next = new Set(this.eliminandoMiembros);
          next.delete(miembro.idUsuario);
          this.eliminandoMiembros = next;
          this.errorEliminarMiembro = extractHttpErrorMessage(err, 'No se pudo eliminar el miembro.');
          this.cdr.markForCheck();
        },
      });
  }

  cambiarRolMiembro(miembro: Member, nuevoRol: string): void {
    if (!nuevoRol || nuevoRol === miembro.rol) return;
    this.pendingRolMiembro  = miembro;
    this.pendingRolNuevo    = nuevoRol;
    this.confirmarRolVisible = true;
    this.cdr.markForCheck();
  }

  confirmarCambioRol(): void {
    const miembro  = this.pendingRolMiembro!;
    const nuevoRol = this.pendingRolNuevo;
    this.confirmarRolVisible = false;
    this.pendingRolMiembro   = null;
    this.pendingRolNuevo     = '';

    this.cambiandoRoles = new Set(this.cambiandoRoles).add(miembro.idUsuario);
    this.errorCambioRol = '';
    this.cdr.markForCheck();

    this.grupoService.cambiarRolMiembro(this.idGrupo, miembro.idUsuario, nuevoRol)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const updated = this.miembros.map(m =>
            m.idUsuario === miembro.idUsuario ? { ...m, rol: nuevoRol } : m
          );
          const next = new Set(this.cambiandoRoles);
          next.delete(miembro.idUsuario);
          this.cambiandoRoles = next;
          this.miembrosUpdated.emit(updated);
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

  cancelarCambioRol(): void {
    this.confirmarRolVisible = false;
    this.pendingRolMiembro   = null;
    this.pendingRolNuevo     = '';
    this.cdr.markForCheck();
  }

  private recargarMiembros(): void {
    this.grupoService.obtenerMiembros(this.idGrupo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (miembros) => {
          this.miembrosUpdated.emit(miembros);
          this.cdr.markForCheck();
        },
        error: () => {
          this.cdr.markForCheck();
        },
      });
  }
}
