import { Injectable } from '@angular/core';

import type { AppConfig } from './app-config.model';

@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
  private config?: AppConfig;

  get(): AppConfig {
    if (!this.config) {
      throw new Error('AppConfig no cargado');
    }
    return this.config;
  }

  async load(): Promise<void> {
    const res = await fetch('/assets/config.json', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`No se pudo cargar /assets/config.json (status=${res.status})`);
    }

    this.config = (await res.json()) as AppConfig;

    if (!this.config.API_URL) {
      throw new Error('config.API_URL es requerido');
    }
  }
}
