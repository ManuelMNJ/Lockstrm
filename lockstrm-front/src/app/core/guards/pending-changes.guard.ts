import { CanDeactivateFn } from '@angular/router';

export interface PendingChanges {
  hasPendingChanges(): boolean;
}

export const pendingChangesGuard: CanDeactivateFn<PendingChanges> = (component) => {
  if (!component.hasPendingChanges()) return true;
  return confirm('Tienes cambios sin guardar. ¿Seguro que quieres salir?');
};
