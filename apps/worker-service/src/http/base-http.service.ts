import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BaseHttpService {
  constructor(private readonly http: HttpService) {}

  async post<T>(url: string, body: unknown): Promise<T> {
    const timeoutMs = Number(process.env.HTTP_TIMEOUT_MS ?? 5000);

    const res = await firstValueFrom(
      this.http.post<T>(url, body, {
        timeout: timeoutMs,
        validateStatus: () => true,
      }),
    );

    if (res.status >= 200 && res.status < 300) {
      return res.data;
    }

    throw new Error(`HTTP ${res.status} calling ${url}`);
  }
}
