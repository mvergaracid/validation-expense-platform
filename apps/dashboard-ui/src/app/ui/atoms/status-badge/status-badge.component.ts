import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import type { FileProcessStatus } from '../../../core/api/file-process.model';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html'
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: FileProcessStatus;

  badgeClass(): string {
    switch (this.status) {
      case 'COMPLETADO':
        return 'bg-success text-success-fg';
      case 'ERROR':
        return 'bg-danger text-danger-fg';
      default:
        return 'bg-primary text-primary-fg';
    }
  }
}
