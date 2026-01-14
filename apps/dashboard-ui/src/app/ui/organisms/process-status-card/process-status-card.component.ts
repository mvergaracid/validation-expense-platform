import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import type { FileProcess } from '../../../core/api/file-process.model';
import { StatusBadgeComponent } from '../../atoms/status-badge/status-badge.component';

@Component({
  selector: 'app-process-status-card',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  templateUrl: './process-status-card.component.html'
})
export class ProcessStatusCardComponent {
  @Input({ required: true }) process!: FileProcess;

  @Output() viewDuplicates = new EventEmitter<void>();
  @Output() viewNegatives = new EventEmitter<void>();
}
