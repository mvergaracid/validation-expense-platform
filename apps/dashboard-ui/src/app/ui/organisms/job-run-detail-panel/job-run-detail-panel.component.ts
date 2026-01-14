import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import type { JobRunDetail, JobRunStage } from '../../../core/api/job-run.model';

@Component({
  selector: 'app-job-run-detail-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'job-run-detail-panel.component.html'
})
export class JobRunDetailPanelComponent {
  @Input() detail: JobRunDetail | null = null;
  @Input() emptyText = 'Selecciona un job para ver sus etapas.';

  protected getAlertas(stage: JobRunStage | undefined | null): Array<{ codigo?: string; mensaje?: string }> {
    if (!stage?.data) return [];
    const raw = (stage.data as Record<string, unknown>)['alertas'];
    if (!Array.isArray(raw)) return [];
    return raw as Array<{ codigo?: string; mensaje?: string }>;
  }
}
