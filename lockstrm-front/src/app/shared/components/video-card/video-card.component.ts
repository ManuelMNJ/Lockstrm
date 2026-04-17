import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Video } from '../../../core/services/video.service';
import { VideoDurationPipe } from '../../pipes/video-duration.pipe';

@Component({
  selector: 'app-video-card',
  standalone: true,
  imports: [CommonModule, VideoDurationPipe],
  templateUrl: './video-card.component.html',
  styleUrl: './video-card.component.css',
})
export class VideoCardComponent {
  @Input() video!: Video;
  @Input() index?: number;
  @Input() showGroup = false;
  @Input() showDate = false;
  @Input() canView = false;
  @Input() canEdit = false;
  @Input() canDelete = false;
  @Input() canRemove = false;
  @Input() isDeleting = false;

  @Output() cardClicked  = new EventEmitter<void>();
  @Output() viewClicked   = new EventEmitter<void>();
  @Output() editClicked   = new EventEmitter<void>();
  @Output() deleteClicked = new EventEmitter<void>();
  @Output() removeClicked = new EventEmitter<void>();

  onCardClick(): void {
    if (this.cardClicked.observed) this.cardClicked.emit();
  }
}
