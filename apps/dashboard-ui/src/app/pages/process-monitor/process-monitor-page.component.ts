import { CommonModule, DatePipe } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';

import type { FileProcess, FileProcessBatch } from '../../core/api/file-process.model';
import { ValidationPersistenceClient } from '../../core/api/validation-persistence.client';
import type { JobRun, JobRunDetail } from '../../core/api/job-run.model';
import type { JobRunStatus } from '../../core/api/job-run.model';
import { ActionButtonComponent } from '../../ui/atoms/action-button/action-button.component';
import { FileDropzoneComponent } from '../../ui/molecules/file-dropzone/file-dropzone.component';
import { ProcessStatusCardComponent } from '../../ui/organisms/process-status-card/process-status-card.component';
import { JobRunDetailPanelComponent } from '../../ui/organisms/job-run-detail-panel/job-run-detail-panel.component';
import { WarningDialogComponent } from '../../ui/molecules/warning-dialog/warning-dialog.component';

@Component({
  selector: 'app-process-monitor-page',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ActionButtonComponent,
    FileDropzoneComponent,
    ProcessStatusCardComponent,
    JobRunDetailPanelComponent,
    WarningDialogComponent,
  ],
  templateUrl: './process-monitor-page.component.html'
})
export class ProcessMonitorPageComponent implements OnDestroy {
  private readonly api = inject(ValidationPersistenceClient);

  protected readonly auditDialogOpen = signal(false);
  protected readonly isLoadingAudit = signal(false);
  protected readonly auditKind = signal<'duplicate' | 'negative' | null>(null);
  protected readonly auditItems = signal<
    Array<{
      job_id: string;
      expense_id: string | null;
      fingerprint: string | null;
      created_at: string;
      meta: Record<string, unknown> | null;
      expense_fecha: string | null;
      expense_moneda_original: string | null;
      expense_monto_original: string | null;
      expense_validation_status: string | null;
    }>
  >([]);

  protected displayStatus(job: JobRun): string {
    const meta = (job.meta ?? {}) as any;
    const validationStatus =
      meta?.validation && typeof meta.validation === 'object' && typeof meta.validation.status === 'string'
        ? String(meta.validation.status).toUpperCase()
        : null;
    return validationStatus ?? job.status;
  }

  protected auditTitle(): string {
    const kind = this.auditKind();
    if (kind === 'duplicate') return 'Duplicados (skipped por dedup)';
    if (kind === 'negative') return 'Negativos (skipped por monto negativo)';
    return '';
  }

  protected async openAudit(kind: 'duplicate' | 'negative'): Promise<void> {
    const processId = this.selectedProcessId();
    if (!processId) return;

    this.auditKind.set(kind);
    this.auditDialogOpen.set(true);
    this.isLoadingAudit.set(true);
    this.auditItems.set([]);

    try {
      const res = await this.api.getProcessAudit(processId, kind);
      this.auditItems.set(res.items);
    } finally {
      this.isLoadingAudit.set(false);
    }
  }

  protected closeAudit(): void {
    this.auditDialogOpen.set(false);
    this.auditKind.set(null);
    this.auditItems.set([]);
  }

  @ViewChild('jobsList') private readonly jobsList?: ElementRef<HTMLDivElement>;
  @ViewChild('detailPanel') private readonly detailPanel?: ElementRef<HTMLDivElement>;
  protected readonly detailOffsetPx = signal(0);

  private errorMessage(e: unknown): string | null {
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
      return (e as any).message;
    }
    return null;
  }

  protected readonly processes = signal<FileProcess[]>([]);
  protected readonly selectedProcessId = signal<string | null>(null);
  protected readonly process = signal<FileProcess | null>(null);
  protected readonly batches = signal<FileProcessBatch[] | null>(null);

  protected readonly jobs = signal<JobRun[]>([]);
  protected readonly selectedJob = signal<JobRunDetail | null>(null);

  protected readonly jobStatusFilter = signal<JobRunStatus | 'all'>('all');
  protected readonly validationStatusFilter = signal<'all' | 'APROBADO' | 'PENDIENTE' | 'RECHAZADO'>('all');

  protected readonly isUploading = signal(false);
  protected readonly isLoadingProcesses = signal(false);
  protected readonly isLoadingJobs = signal(false);
  protected readonly uploadDialogOpen = signal(false);
  protected readonly deleteProcessDialogOpen = signal(false);
  protected readonly isDeletingProcess = signal(false);
  protected readonly error = signal<string | null>(null);

  private pollTimer?: number;

  constructor() {
    void this.refreshProcesses();
  }

  private async refreshProcesses(): Promise<void> {
    this.isLoadingProcesses.set(true);
    try {
      const list = await this.api.getProcesses({ limit: 50 });
      this.processes.set(list);
    } finally {
      this.isLoadingProcesses.set(false);
    }
  }

  protected async selectProcess(processId: string): Promise<void> {
    if (!processId || processId === this.selectedProcessId()) return;
    this.selectedProcessId.set(processId);
    this.selectedJob.set(null);
    this.jobs.set([]);
    await this.refreshSelectedProcess(processId);
    await this.refreshJobs(processId);
    this.startPolling(processId);
  }

  private async refreshSelectedProcess(processId: string): Promise<void> {
    const p = await this.api.getProcess(processId);
    const current = this.process();
    const shouldUpdateProcess =
      !current ||
      current.status !== p.status ||
      current.total_records !== p.total_records ||
      current.published_batches !== p.published_batches ||
      current.processed_records !== p.processed_records ||
      current.pending_records !== p.pending_records ||
      current.rejected_records !== p.rejected_records ||
      current.skipped_records !== p.skipped_records ||
      current.negative_records !== p.negative_records ||
      current.duplicate_records !== p.duplicate_records ||
      current.error_message !== p.error_message ||
      current.finished_at !== p.finished_at;

    if (shouldUpdateProcess) {
      this.process.set(p);
    }

    try {
      const batches = await this.api.getProcessBatches(processId);
      const prev = this.batches();
      const unchanged =
        Array.isArray(prev) &&
        prev.length === batches.length &&
        prev.every((b, i) => b.batch_index === batches[i].batch_index && b.record_count === batches[i].record_count);
      if (!unchanged) {
        this.batches.set(batches);
      }
    } catch {
      if (this.batches() !== null) {
        this.batches.set(null);
      }
    }
  }

  private async refreshJobs(processId: string, options?: { showLoading?: boolean }): Promise<void> {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) {
      this.isLoadingJobs.set(true);
    }
    try {
      const statusFilter = this.jobStatusFilter();
      const res = await this.api.getJobs({
        page: 1,
        pageSize: 50,
        processId,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });

      const validationFilter = this.validationStatusFilter();
      const filtered =
        validationFilter === 'all'
          ? res.data
          : res.data.filter((j) => {
              const meta = (j.meta ?? {}) as any;
              const status =
                meta?.validation && typeof meta.validation === 'object' && typeof meta.validation.status === 'string'
                  ? String(meta.validation.status).toUpperCase()
                  : null;
              return status === validationFilter;
            });

      const prev = this.jobs();
      const prevById = new Map(prev.map((j) => [j.job_id, j] as const));
      const next = filtered.map((incoming) => {
        const existing = prevById.get(incoming.job_id);
        if (!existing) return incoming;

        const incomingBatchIndex = (incoming.meta as any)?.batchIndex;
        const existingBatchIndex = (existing.meta as any)?.batchIndex;

        const unchanged =
          existing.status === incoming.status &&
          existing.pattern === incoming.pattern &&
          existing.created_at === incoming.created_at &&
          existingBatchIndex === incomingBatchIndex;

        return unchanged ? existing : incoming;
      });

      const prevIds = prev.map((j) => j.job_id).join(',');
      const nextIds = next.map((j) => j.job_id).join(',');
      const idsChanged = prevIds !== nextIds;
      const anyRefChanged = !idsChanged && next.some((j, idx) => j !== prev[idx]);

      if (idsChanged || anyRefChanged) {
        this.jobs.set(next);
      }
    } finally {
      if (showLoading) {
        this.isLoadingJobs.set(false);
      }
    }
  }

  protected async applyJobFilters(): Promise<void> {
    const processId = this.selectedProcessId();
    if (!processId) return;
    this.jobs.set([]);
    this.selectedJob.set(null);
    await this.refreshJobs(processId);
  }

  protected async selectJob(jobId: string): Promise<void> {
    if (!jobId) return;
    const detail = await this.api.getJob(jobId);
    this.selectedJob.set(detail);

    requestAnimationFrame(() => {
      this.alignDetailToJob(jobId);
    });
  }

  protected onJobsListScroll(): void {
    const jobId = this.selectedJob()?.run?.job_id;
    if (!jobId) return;
    this.alignDetailToJob(jobId);
  }

  protected batchIndex(job: JobRun | null | undefined): number | null {
    const raw = job?.meta && typeof job.meta === 'object' ? (job.meta as any).batchIndex : undefined;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }

  private alignDetailToJob(jobId: string): void {
    const listEl = this.jobsList?.nativeElement;
    if (!listEl) return;

    const detailEl = this.detailPanel?.nativeElement;
    if (!detailEl) return;

    const selectedEl = listEl.querySelector(`[data-job-id="${jobId}"]`) as HTMLElement | null;
    if (!selectedEl) return;

    const listRect = listEl.getBoundingClientRect();
    const jobRect = selectedEl.getBoundingClientRect();

    const positionInViewport = Math.round(jobRect.top - listRect.top);

    const maxOffset = Math.max(0, Math.round(listEl.clientHeight - detailEl.clientHeight));
    const clampedOffset = Math.min(Math.max(0, positionInViewport), maxOffset);
    this.detailOffsetPx.set(clampedOffset);
  }

  protected openDeleteProcessDialog(): void {
    if (this.isDeletingProcess()) return;
    if (!this.selectedProcessId()) return;
    this.deleteProcessDialogOpen.set(true);
  }

  protected closeDeleteProcessDialog(): void {
    this.deleteProcessDialogOpen.set(false);
  }

  protected confirmDeleteProcess(): void {
    this.closeDeleteProcessDialog();
    void this.runDeleteProcess(true);
  }

  protected async downloadProcessReport(): Promise<void> {
    const process = this.process();
    if (!process) return;

    const blob = await this.api.downloadProcessReportPdf(process.process_id);
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      const safeName = (process.filename ?? 'process').replace(/[^a-zA-Z0-9._-]+/g, '_');
      a.download = `${safeName}.report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  protected cancelDeleteProcess(): void {
    this.closeDeleteProcessDialog();
  }

  private async runDeleteProcess(hard: boolean): Promise<void> {
    const processId = this.selectedProcessId();
    if (!processId || this.isDeletingProcess()) return;

    this.isDeletingProcess.set(true);
    this.error.set(null);
    this.stopPolling();

    try {
      await this.api.deleteProcess(processId, { hard });
      await this.refreshProcesses();
      this.selectedProcessId.set(null);
      this.process.set(null);
      this.batches.set(null);
      this.jobs.set([]);
      this.selectedJob.set(null);
    } catch (e) {
      this.error.set(this.errorMessage(e));
    } finally {
      this.isDeletingProcess.set(false);
    }
  }

  protected openUploadDialog(): void {
    this.error.set(null);
    this.uploadDialogOpen.set(true);
  }

  protected closeUploadDialog(): void {
    this.uploadDialogOpen.set(false);
  }

  async onFileSelected(file: File): Promise<void> {
    this.error.set(null);

    const name = (file.name ?? '').toLowerCase();
    if (!name.endsWith('.csv')) {
      this.error.set('El archivo debe ser .csv');
      return;
    }

    this.isUploading.set(true);
    this.closeUploadDialog();
    this.stopPolling();

    try {
      const { processId } = await this.api.uploadCsv(file);
      await this.refreshProcesses();
      await this.selectProcess(processId);
    } catch (e) {
      this.error.set(this.errorMessage(e));
    } finally {
      this.isUploading.set(false);
    }
  }

  private startPolling(processId: string): void {
    this.stopPolling();

    this.pollTimer = window.setInterval(() => {
      void (async () => {
        await this.refreshSelectedProcess(processId);
        await this.refreshJobs(processId, { showLoading: false });
      })().catch((e) => {
        this.error.set(this.errorMessage(e));
        this.stopPolling();
      });
    }, 1500);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

}
