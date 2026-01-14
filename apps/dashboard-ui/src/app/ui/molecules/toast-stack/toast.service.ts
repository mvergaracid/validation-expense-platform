import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'danger';

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<ToastMessage[]>([]);
  private readonly timers = new Map<string, number>();

  readonly toasts = this.toastsSignal.asReadonly();

  show(
    toast: Omit<ToastMessage, 'id'> & {
      durationMs?: number;
    },
  ): string {
    const id = this.generateId();
    const duration = toast.durationMs ?? 4000;

    this.toastsSignal.update((prev) => [{ id, tone: toast.tone, title: toast.title, description: toast.description }, ...prev]);
    this.scheduleDismiss(id, duration);
    return id;
  }

  dismiss(id: string): void {
    this.clearTimer(id);
    this.toastsSignal.update((prev) => prev.filter((toast) => toast.id !== id));
  }

  private scheduleDismiss(id: string, duration: number): void {
    this.clearTimer(id);
    const timer = window.setTimeout(() => this.dismiss(id), duration);
    this.timers.set(id, timer);
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      window.clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2);
  }
}
