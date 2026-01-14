export type JobRunStatus = 'running' | 'success' | 'failed' | 'skipped';
export type JobStageStatus = 'running' | 'success' | 'failed' | 'skipped';

export interface JobRun {
  job_id: string;
  pattern: string;
  expense_id: string | null;
  fingerprint: string | null;
  status: JobRunStatus;
  finished_at: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface PaginatedJobsResponse {
  data: JobRun[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface JobRunStage {
  id: string;
  job_id: string;
  stage: string;
  status: JobStageStatus;
  finished_at: string | null;
  data: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export interface JobRunDetail {
  run: JobRun;
  stages: JobRunStage[];
}
