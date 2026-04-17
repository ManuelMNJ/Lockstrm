import { Component, HostListener, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.css',
})
export class ConfirmModalComponent {

  protected readonly modalService = inject(ModalService);
  readonly config$ = this.modalService.config$;

  confirm(): void { this.modalService.respond(true);  }
  cancel():  void { this.modalService.respond(false); }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalService.isOpen) this.cancel();
  }
}
