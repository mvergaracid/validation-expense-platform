export type FileProcessStatus = 'PROCESANDO' | 'COMPLETADO' | 'ERROR';

export interface FileProcess {
  process_id: string;
  filename: string;
  storage_uri: string;
  status: FileProcessStatus;
  total_records: number;
  published_batches: number;
  processed_records?: number;
  pending_records?: number;
  rejected_records?: number;
  skipped_records?: number;
  negative_records?: number;
  duplicate_records?: number;
  error_message?: string | null;
  created_at: string;
  finished_at?: string | null;
}

export interface FileProcessBatch {
  id: string;
  process_id: string;
  batch_index: number;
  record_count: number;
  expense_ids: string[] | null;
  created_at: string;
}

export interface UploadResponse {
  processId: string;
}
