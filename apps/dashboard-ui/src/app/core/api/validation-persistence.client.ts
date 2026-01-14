import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppConfigService } from '../config/app-config.service';
import type { FileProcess, FileProcessBatch, UploadResponse } from './file-process.model';
import type { JobRun, JobRunDetail, JobRunStatus, PaginatedJobsResponse } from './job-run.model';

@Injectable({
  providedIn: 'root'
})
export class ValidationPersistenceClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private baseUrl(): string {
    return this.config.get().API_URL.replace(/\/$/, '');
  }

  uploadCsv(file: File): Promise<UploadResponse> {
    const fd = new FormData();
    fd.append('file', file);

    return firstValueFrom(this.http.post<UploadResponse>(`${this.baseUrl()}/uploads`, fd));
  }

  getProcess(processId: string): Promise<FileProcess> {
    return firstValueFrom(
      this.http.get<FileProcess>(`${this.baseUrl()}/processes/${encodeURIComponent(processId)}`)
    );
  }

  getProcessAudit(processId: string, kind: 'duplicate' | 'negative'): Promise<{
    items: Array<{
      job_id: string;
      expense_id: string | null;
      fingerprint: string | null;
      created_at: string;
      meta: Record<string, unknown> | null;
      expense_fecha: string | null;
      expense_moneda_original: string | null;
      expense_monto_original: string | null;
      expense_validation_status: string | null;
    }>;
  }> {
    const q = new URLSearchParams();
    q.set('kind', kind);
    const url = `${this.baseUrl()}/processes/${encodeURIComponent(processId)}/audit?${q.toString()}`;
    return firstValueFrom(
      this.http.get<{
        items: Array<{
          job_id: string;
          expense_id: string | null;
          fingerprint: string | null;
          created_at: string;
          meta: Record<string, unknown> | null;
          expense_fecha: string | null;
          expense_moneda_original: string | null;
          expense_monto_original: string | null;
          expense_validation_status: string | null;
        }>;
      }>(url),
    );
  }

  downloadProcessReportPdf(processId: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.baseUrl()}/processes/${encodeURIComponent(processId)}/report.pdf`, {
        responseType: 'blob',
      }),
    );
  }

  getFxCache(params?: { date?: string; prefix?: 'fx' | 'fx_table' | 'all'; limit?: number }): Promise<{
    items: Array<
      | {
          key: string;
          prefix: 'fx';
          from: string;
          to: string;
          date: string;
          rate: number;
          fetchedAt: number;
          ttlSeconds: number;
          expiresAt: number | null;
        }
      | {
          key: string;
          prefix: 'fx_table';
          date: string;
          base: string;
          currencies: number;
          rates: Record<string, number>;
          fetchedAt: number;
          ttlSeconds: number;
          expiresAt: number | null;
        }
    >;
    nextCursor: string | null;
  }> {
    const q = new URLSearchParams();
    if (params?.date) {
      q.set('date', params.date);
    }
    if (typeof params?.limit === 'number') {
      q.set('limit', String(params.limit));
    }
    if (params?.prefix) {
      q.set('prefix', params.prefix);
    }
    const qs = q.toString();
    const url = qs ? `${this.baseUrl()}/cache/fx?${qs}` : `${this.baseUrl()}/cache/fx`;
    return firstValueFrom(
      this.http.get<{
        items: Array<
          | {
              key: string;
              prefix: 'fx';
              from: string;
              to: string;
              date: string;
              rate: number;
              fetchedAt: number;
              ttlSeconds: number;
              expiresAt: number | null;
            }
          | {
              key: string;
              prefix: 'fx_table';
              date: string;
              base: string;
              currencies: number;
              rates: Record<string, number>;
              fetchedAt: number;
              ttlSeconds: number;
              expiresAt: number | null;
            }
        >;
        nextCursor: string | null;
      }>(url),
    );
  }

  deleteFxCache(params?: { date?: string; prefix?: 'fx' | 'fx_table' | 'all' }): Promise<{ deleted: number }> {
    const q = new URLSearchParams();
    if (params?.date) {
      q.set('date', params.date);
    }
    if (params?.prefix) {
      q.set('prefix', params.prefix);
    }
    const qs = q.toString();
    const url = qs ? `${this.baseUrl()}/cache/fx?${qs}` : `${this.baseUrl()}/cache/fx`;
    return firstValueFrom(this.http.delete<{ deleted: number }>(url));
  }

  getProcesses(params?: { limit?: number }): Promise<FileProcess[]> {
    const q = new URLSearchParams();
    if (typeof params?.limit === 'number') {
      q.set('limit', String(params.limit));
    }
    const qs = q.toString();
    const url = qs ? `${this.baseUrl()}/processes?${qs}` : `${this.baseUrl()}/processes`;
    return firstValueFrom(this.http.get<FileProcess[]>(url));
  }

  getProcessBatches(processId: string): Promise<FileProcessBatch[]> {
    return firstValueFrom(
      this.http.get<FileProcessBatch[]>(
        `${this.baseUrl()}/processes/${encodeURIComponent(processId)}/batches`,
      ),
    );
  }

  deleteProcess(processId: string, params?: { hard?: boolean }): Promise<{ deleted: boolean }> {
    const q = new URLSearchParams();
    if (params?.hard) {
      q.set('hard', 'true');
    }
    const qs = q.toString();
    const url = qs
      ? `${this.baseUrl()}/processes/${encodeURIComponent(processId)}?${qs}`
      : `${this.baseUrl()}/processes/${encodeURIComponent(processId)}`;
    return firstValueFrom(this.http.delete<{ deleted: boolean }>(url));
  }

  getJobs(params?: {
    page?: number;
    pageSize?: number;
    status?: JobRunStatus;
    expenseId?: string;
    processId?: string;
  }): Promise<PaginatedJobsResponse> {
    const q = new URLSearchParams();
    if (typeof params?.page === 'number') {
      q.set('page', String(params.page));
    }
    if (typeof params?.pageSize === 'number') {
      q.set('pageSize', String(params.pageSize));
    }
    if (params?.status) {
      q.set('status', params.status);
    }
    if (params?.expenseId) {
      q.set('expenseId', params.expenseId);
    }
    if (params?.processId) {
      q.set('processId', params.processId);
    }
    const qs = q.toString();
    const url = qs ? `${this.baseUrl()}/jobs?${qs}` : `${this.baseUrl()}/jobs`;
    return firstValueFrom(this.http.get<PaginatedJobsResponse>(url));
  }

  getJob(jobId: string): Promise<JobRunDetail> {
    return firstValueFrom(this.http.get<JobRunDetail>(`${this.baseUrl()}/jobs/${encodeURIComponent(jobId)}`));
  }

  deleteJobs(jobIds: string[]): Promise<{ deleted: number }> {
    return firstValueFrom(
      this.http.request<{ deleted: number }>('DELETE', `${this.baseUrl()}/jobs`, {
        body: { jobIds },
      })
    );
  }

  getCurrentPolicy(): Promise<{ name: string; policies: Record<string, unknown>; created_at: string; updated_at: string } | null> {
    return firstValueFrom(
      this.http.get<{ name: string; policies: Record<string, unknown>; created_at: string; updated_at: string } | null>(
        `${this.baseUrl()}/policies/current`,
      ),
    );
  }

  setCurrentPolicy(policies: Record<string, unknown>): Promise<{ name: string; policies: Record<string, unknown>; created_at: string; updated_at: string }> {
    return firstValueFrom(
      this.http.put<{ name: string; policies: Record<string, unknown>; created_at: string; updated_at: string }>(
        `${this.baseUrl()}/policies/current`,
        policies,
      ),
    );
  }
}
