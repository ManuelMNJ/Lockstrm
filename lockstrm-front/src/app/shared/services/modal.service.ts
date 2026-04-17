import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ModalConfig {
  title:        string;
  message:      string;
  confirmLabel: string;
  cancelLabel:  string;
  resolve:      (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ModalService {

  private readonly _config$ = new BehaviorSubject<ModalConfig | null>(null);
  readonly config$ = this._config$.asObservable();

  confirm(
    title:        string,
    message:      string,
    confirmLabel = 'Confirmar',
    cancelLabel  = 'Cancelar',
  ): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this._config$.next({ title, message, confirmLabel, cancelLabel, resolve });
    });
  }

  get isOpen(): boolean {
    return this._config$.value !== null;
  }

  respond(result: boolean): void {
    const cfg = this._config$.value;
    if (cfg) {
      this._config$.next(null);
      cfg.resolve(result);
    }
  }
}
