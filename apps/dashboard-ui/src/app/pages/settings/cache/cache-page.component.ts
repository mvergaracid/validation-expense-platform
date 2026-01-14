import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { ValidationPersistenceClient } from '../../../core/api/validation-persistence.client';
import { ActionButtonComponent } from '../../../ui/atoms/action-button/action-button.component';
import { SelectInputComponent, type SelectOption } from '../../../ui/atoms/select-input/select-input.component';
import { ToastService } from '../../../ui/molecules/toast-stack/toast.service';

type FxCacheItem = {
  key: string;
  prefix: 'fx';
  from: string;
  to: string;
  date: string;
  rate: number;
  fetchedAt: number;
  ttlSeconds: number;
  expiresAt: number | null;
};

type FxTableCacheItem = {
  key: string;
  prefix: 'fx_table';
  date: string;
  base: string;
  currencies: number;
  rates: Record<string, number>;
  fetchedAt: number;
  ttlSeconds: number;
  expiresAt: number | null;
};

type FxCacheRow = FxCacheItem | FxTableCacheItem;

@Component({
  selector: 'app-cache-page',
  standalone: true,
  imports: [CommonModule, DatePipe, ActionButtonComponent, SelectInputComponent],
  templateUrl: './cache-page.component.html',
})
export class CachePageComponent {
  private readonly api = inject(ValidationPersistenceClient);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<FxCacheRow[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly dateFilter = signal<string>('');
  protected readonly listPrefix = signal<'all' | 'fx' | 'fx_table'>('all');
  protected readonly deletePrefix = signal<'all' | 'fx' | 'fx_table'>('all');

  readonly listPrefixOptions: Array<SelectOption<'all' | 'fx' | 'fx_table'>> = [
    { value: 'all', label: 'todas (fx + fx_table)' },
    { value: 'fx', label: 'solo fx' },
    { value: 'fx_table', label: 'solo fx_table' },
  ];

  readonly deletePrefixOptions: Array<SelectOption<'all' | 'fx' | 'fx_table'>> = [
    { value: 'all', label: 'todas (fx + fx_table)' },
    { value: 'fx', label: 'solo fx' },
    { value: 'fx_table', label: 'solo fx_table' },
  ];

  protected readonly expandedKey = signal<string | null>(null);

  private pendingReload = false;

  constructor() {
    void this.load();
  }

  private errorMessage(e: unknown): string | null {
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
      return (e as any).message;
    }
    return null;
  }

  protected onDateChange(evt: Event): void {
    const target = evt.target as HTMLInputElement | null;
    if (!target) return;
    this.dateFilter.set(target.value ?? '');
  }

  protected onDeletePrefixChange(next: 'all' | 'fx' | 'fx_table'): void {
    this.deletePrefix.set(next);
  }

  protected onListPrefixChange(next: 'all' | 'fx' | 'fx_table'): void {
    this.listPrefix.set(next);
    this.expandedKey.set(null);
    this.pendingReload = true;
    void this.load();
  }

  protected toggleExpanded(key: string): void {
    this.expandedKey.set(this.expandedKey() === key ? null : key);
  }

  protected async load(): Promise<void> {
    if (this.isLoading()) return;
    this.error.set(null);
    this.isLoading.set(true);

    try {
      this.pendingReload = false;
      const date = this.dateFilter().trim();
      const prefix = this.listPrefix();
      const res = await this.api.getFxCache({
        ...(date.length ? { date } : {}),
        ...(prefix !== 'all' ? { prefix } : {}),
        limit: 500,
      });
      this.items.set(res.items);
    } catch (e) {
      const msg = this.errorMessage(e) ?? 'Error al cargar cache';
      this.error.set(msg);
      this.toast.show({
        tone: 'danger',
        title: 'Error al cargar cache',
        description: msg,
      });
    } finally {
      this.isLoading.set(false);
      if (this.pendingReload) {
        void this.load();
      }
    }
  }

  protected async clearCache(): Promise<void> {
    if (this.isDeleting()) return;
    this.error.set(null);
    this.isDeleting.set(true);

    try {
      const date = this.dateFilter().trim();
      const prefix = this.deletePrefix();
      const res = await this.api.deleteFxCache({
        ...(date.length ? { date } : {}),
        prefix,
      });
      this.toast.show({
        tone: 'success',
        title: 'Cache borrada',
        description: `Se borraron ${res.deleted} keys.`,
      });
      await this.load();
    } catch (e) {
      const msg = this.errorMessage(e) ?? 'Error al borrar cache';
      this.error.set(msg);
      this.toast.show({
        tone: 'danger',
        title: 'Error al borrar cache',
        description: msg,
      });
    } finally {
      this.isDeleting.set(false);
    }
  }
}
