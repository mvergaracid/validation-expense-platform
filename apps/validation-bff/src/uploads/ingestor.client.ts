import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class IngestorClient {
  async startIngestion(params: { storageUri: string; filename: string }): Promise<{ processId: string }> {
    const baseUrl = process.env.INGESTOR_URL;
    if (!baseUrl) {
      throw new Error('INGESTOR_URL es requerido');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/ingestions`;
    const res = await axios.post<{ processId: string }>(url, {
      storageUri: params.storageUri,
      filename: params.filename,
    });

    if (!res?.data?.processId) {
      throw new Error('ingestor-service response inválida: falta processId');
    }

    return { processId: res.data.processId };
  }
}
