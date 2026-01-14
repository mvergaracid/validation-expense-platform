import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ValidationPersistenceClient } from '../../core/api/validation-persistence.client';
import type {
  JobRun,
  JobRunDetail,
  JobRunStatus,
  PaginatedJobsResponse,
} from '../../core/api/job-run.model';
import { ActionButtonComponent } from '../../ui/atoms/action-button/action-button.component';
import { WarningDialogComponent } from '../../ui/molecules/warning-dialog/warning-dialog.component';
import { ToastService } from '../../ui/molecules/toast-stack/toast.service';
import { JobRunDetailPanelComponent } from '../../ui/organisms/job-run-detail-panel/job-run-detail-panel.component';

@Component({
  selector: 'app-jobs-page',
  standalone: true,
  imports: [CommonModule, DatePipe, ActionButtonComponent, WarningDialogComponent, JobRunDetailPanelComponent],
  templateUrl: './jobs-page.component.html'
})
export class JobsPageComponent implements OnInit {
  private readonly api = inject(ValidationPersistenceClient);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  protected displayStatus(job: JobRun): string {
    const meta = (job.meta ?? {}) as any;
    const validationStatus =
      meta?.validation && typeof meta.validation === 'object' && typeof meta.validation.status === 'string'
        ? String(meta.validation.status).toUpperCase()
        : null;
    return validationStatus ?? job.status;
  }

  private errorMessage(e: unknown): string | null {
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
      return (e as any).message;
    }
    return null;
  }

  private extractError(e: unknown): { message: string; status?: number } {
    if (e instanceof HttpErrorResponse) {
      let message: string | null = null;
      if (typeof e.error === 'string' && e.error.trim().length) {
        message = e.error;
      } else if (
        e.error &&
        typeof e.error === 'object' &&
        'message' in e.error &&
        typeof (e.error as Record<string, unknown>)['message'] === 'string'
      ) {
        message = (e.error as Record<string, unknown>)['message'] as string;
      }
      return {
        message: message ?? e.message ?? 'Se produjo un error inesperado.',
        status: e.status || undefined,
      };
    }
    return { message: this.errorMessage(e) ?? 'Se produjo un error inesperado.' };
  }

  private showErrorToast(message: string, context: string, status?: number): void {
    const title = status ? `${context} (HTTP ${status})` : context;
    this.toast.show({
      tone: 'danger',
      title,
      description: message,
    });
  }

  private showSuccessToast(title: string, description?: string): void {
    this.toast.show({
      tone: 'success',
      title,
      description,
    });
  }

  protected readonly jobs = signal<JobRun[]>([]);
  protected readonly selected = signal<JobRunDetail | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly statusFilter = signal<JobRunStatus | 'all'>('all');
  protected readonly processIdFilter = signal<string | null>(null);
  protected readonly selectedJobIds = signal<Set<string>>(new Set());
  protected readonly selectedCount = computed(() => this.selectedJobIds().size);
  protected readonly allJobsSelected = computed(
    () => this.jobs().length > 0 && this.selectedJobIds().size === this.jobs().length,
  );
  protected readonly isDeleting = signal(false);
  protected readonly deleteDialogOpen = signal(false);
  protected readonly pendingDeleteIds = signal<string[]>([]);
  protected readonly deleteDialogDescription = computed(() => {
    const count = this.pendingDeleteIds().length;
    if (count <= 1) {
      return '¿Eliminar el job seleccionado? Esta acción no se puede deshacer.';
    }
    return `¿Eliminar ${count} jobs seleccionados? Esta acción no se puede deshacer.`;
  });

  protected readonly pagination = signal<PaginatedJobsResponse['pagination'] | null>(null);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(25);
  protected readonly pageSizeOptions = [10, 25, 50, 100];
  protected readonly totalItems = computed(() => this.pagination()?.total ?? 0);
  protected readonly totalPages = computed(() => this.pagination()?.totalPages ?? 1);
  protected readonly hasNextPage = computed(() => this.pagination()?.hasNext ?? false);
  protected readonly hasPreviousPage = computed(() => this.pagination()?.hasPrevious ?? false);
  protected readonly pageStartItem = computed(() => {
    const pagination = this.pagination();
    if (!pagination || pagination.total === 0) return 0;
    return (pagination.page - 1) * pagination.pageSize + 1;
  });
  protected readonly pageEndItem = computed(() => {
    const pagination = this.pagination();
    if (!pagination || pagination.total === 0) return 0;
    return Math.min(pagination.page * pagination.pageSize, pagination.total);
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const raw = params.get('processId');
      const normalized = raw && raw.trim().length ? raw.trim() : null;
      if (normalized !== this.processIdFilter()) {
        this.processIdFilter.set(normalized);
        this.selected.set(null);
        this.selectedJobIds.set(new Set());
        this.currentPage.set(1);
        void this.refresh({ notifyOnError: false });
      }
    });
    void this.refresh();
  }

  async refresh(options?: { userInitiated?: boolean; notifyOnError?: boolean }): Promise<void> {
    const userInitiated = options?.userInitiated ?? false;
    const notifyOnError = options?.notifyOnError ?? true;
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const status = this.statusFilter();
      const rawResponse = await this.api.getJobs({
        page: this.currentPage(),
        pageSize: this.pageSize(),
        status: status === 'all' ? undefined : status,
        processId: this.processIdFilter() ?? undefined,
      });
      const { data, pagination } = this.normalizeJobsResponse(rawResponse);
      this.jobs.set(data);
      this.pagination.set(pagination);
      this.currentPage.set(pagination.page);
      this.syncSelectionWithJobs(data);
      if (userInitiated) {
        this.showSuccessToast(
          'Jobs actualizados',
          `Página ${pagination.page} de ${pagination.totalPages} (total ${pagination.total}).`,
        );
      }

      const current = this.selected();
      if (current?.run?.job_id) {
        const still = data.find((j) => j.job_id === current.run.job_id);
        if (still) {
          const detail = await this.api.getJob(current.run.job_id);
          this.selected.set(detail);
        }
      }
    } catch (e) {
      const { message, status } = this.extractError(e);
      this.error.set(message);
      if (notifyOnError) {
        this.showErrorToast(message, 'Error al cargar jobs', status);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async selectJob(jobId: string): Promise<void> {
    this.error.set(null);

    try {
      const detail = await this.api.getJob(jobId);
      this.selected.set(detail);
    } catch (e) {
      const { message, status } = this.extractError(e);
      this.error.set(message);
      this.showErrorToast(message, 'Error al cargar el detalle del job', status);
    }
  }

  setStatusFilter(status: JobRunStatus | 'all'): void {
    this.statusFilter.set(status);
    this.selected.set(null);
    this.selectedJobIds.set(new Set());
    this.currentPage.set(1);
    void this.refresh();
  }

  protected isJobSelected(jobId: string): boolean {
    return this.selectedJobIds().has(jobId);
  }

  protected toggleJobSelection(jobId: string, checked: boolean): void {
    this.selectedJobIds.update((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(jobId);
      } else {
        next.delete(jobId);
      }
      return next;
    });
  }

  protected onJobCheckboxChange(event: Event, jobId: string): void {
    event.stopPropagation();
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    this.toggleJobSelection(jobId, target.checked);
  }

  protected onJobCheckboxKeydown(event: KeyboardEvent, jobId: string): void {
    if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
      event.preventDefault();
      const willSelect = !this.isJobSelected(jobId);
      this.toggleJobSelection(jobId, willSelect);
    }
  }

  protected onSelectAllChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    this.toggleSelectAll(target.checked);
  }

  protected onSelectAllKeydown(event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
      event.preventDefault();
      this.toggleSelectAll(!this.allJobsSelected());
    }
  }

  protected openDeleteDialog(): void {
    if (this.isDeleting()) return;
    const ids = Array.from(this.selectedJobIds());
    if (!ids.length) return;
    this.pendingDeleteIds.set(ids);
    this.deleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.deleteDialogOpen.set(false);
    this.pendingDeleteIds.set([]);
  }

  protected async confirmDeleteSelectedJobs(): Promise<void> {
    const ids = [...this.pendingDeleteIds()];
    if (!ids.length || this.isDeleting()) return;

    this.closeDeleteDialog();
    this.isDeleting.set(true);
    this.error.set(null);
    try {
      await this.api.deleteJobs(ids);
      this.selectedJobIds.set(new Set());
      this.selected.set(null);
      this.showSuccessToast(
        'Jobs eliminados',
        ids.length === 1 ? 'Se eliminó 1 job.' : `Se eliminaron ${ids.length} jobs.`,
      );
      await this.refresh({ userInitiated: false });
    } catch (e) {
      const { message, status } = this.extractError(e);
      this.error.set(message);
      this.showErrorToast(message, 'Error al eliminar jobs', status);
    } finally {
      this.isDeleting.set(false);
    }
  }

  protected goToPreviousPage(): void {
    if (!this.hasPreviousPage() || this.isLoading()) return;
    this.currentPage.update((page) => Math.max(1, page - 1));
    void this.refresh();
  }

  protected goToNextPage(): void {
    if (!this.hasNextPage() || this.isLoading()) return;
    const pagination = this.pagination();
    const maxPage = pagination?.totalPages ?? this.currentPage() + 1;
    this.currentPage.update((page) => Math.min(maxPage, page + 1));
    void this.refresh();
  }

  protected goToPage(page: number): void {
    const pagination = this.pagination();
    const maxPage = pagination?.totalPages ?? page;
    if (page < 1 || page > maxPage || page === this.currentPage() || this.isLoading()) return;
    this.currentPage.set(page);
    void this.refresh();
  }

  protected onPageSizeChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    const value = Number(target.value);
    if (!Number.isFinite(value) || value <= 0) return;
    if (value === this.pageSize()) return;
    this.pageSize.set(value);
    this.currentPage.set(1);
    void this.refresh();
  }

  protected getDisplayedPages(): number[] {
    const total = Math.max(this.totalPages(), 1);
    const current = this.currentPage();
    const radius = 2;
    const start = Math.max(1, current - radius);
    const end = Math.min(total, current + radius);
    const pages: number[] = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    if (!pages.length) {
      pages.push(1);
    }
    return pages;
  }

  private syncSelectionWithJobs(jobs: JobRun[]): void {
    this.selectedJobIds.update((prev) => {
      const next = new Set<string>();
      const jobIds = new Set(jobs.map((job) => job.job_id));
      for (const id of prev) {
        if (jobIds.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }

  private toggleSelectAll(checked: boolean): void {
    if (!checked) {
      this.selectedJobIds.set(new Set());
      return;
    }
    const allIds = new Set(this.jobs().map((job) => job.job_id));
    this.selectedJobIds.set(allIds);
  }

  private normalizeJobsResponse(
    raw: PaginatedJobsResponse | JobRun[],
  ): { data: JobRun[]; pagination: PaginatedJobsResponse['pagination'] } {
    if (Array.isArray(raw)) {
      const data = raw;
      const currentPage = this.currentPage();
      const pageSize = this.pageSize();
      const total = data.length;
      const totalPages = Math.max(Math.ceil(total / (pageSize || 1)), 1);
      const safePage = Math.min(currentPage, totalPages);
      return {
        data,
        pagination: {
          page: safePage,
          pageSize,
          total,
          totalPages,
          hasNext: false,
          hasPrevious: safePage > 1,
        },
      };
    }
    if (raw && Array.isArray(raw.data) && raw.pagination) {
      return raw;
    }

    const fallbackData = raw && Array.isArray((raw as PaginatedJobsResponse).data)
      ? (raw as PaginatedJobsResponse).data
      : [];
    return {
      data: fallbackData,
      pagination: {
        page: 1,
        pageSize: fallbackData.length || this.pageSize(),
        total: fallbackData.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    };
  }
}
