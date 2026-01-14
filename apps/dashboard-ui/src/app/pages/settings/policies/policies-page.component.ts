import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { ValidationPersistenceClient } from '../../../core/api/validation-persistence.client';
import { ActionButtonComponent } from '../../../ui/atoms/action-button/action-button.component';
import { ToastService } from '../../../ui/molecules/toast-stack/toast.service';

@Component({
  selector: 'app-policies-page',
  standalone: true,
  imports: [CommonModule, ActionButtonComponent],
  templateUrl: './policies-page.component.html',
})
export class PoliciesPageComponent {
  private readonly api = inject(ValidationPersistenceClient);
  private readonly toast = inject(ToastService);

  protected readonly policyText = signal<string>('');
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly error = signal<string | null>(null);

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

  protected onPolicyTextChange(evt: Event): void {
    const target = evt.target as HTMLTextAreaElement | null;
    if (!target) return;
    this.policyText.set(target.value);
  }

  protected async load(): Promise<void> {
    if (this.isLoading()) return;
    this.error.set(null);
    this.isLoading.set(true);

    try {
      const current = await this.api.getCurrentPolicy();
      if (current?.policies) {
        this.policyText.set(JSON.stringify(current.policies, null, 2));
      } else {
        this.policyText.set('');
      }
    } catch (e) {
      const msg = this.errorMessage(e) ?? 'Error al cargar policy';
      this.error.set(msg);
      this.toast.show({
        tone: 'danger',
        title: 'Error al cargar policy',
        description: msg,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.isSaving()) return;
    this.error.set(null);

    const raw = this.policyText().trim();
    if (!raw.length) {
      this.error.set('La policy no puede estar vacía');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const msg = 'La policy debe ser un JSON válido';
      this.error.set(msg);
      this.toast.show({
        tone: 'danger',
        title: 'No se pudo guardar',
        description: msg,
      });
      return;
    }

    this.isSaving.set(true);
    try {
      const saved = await this.api.setCurrentPolicy(parsed as Record<string, unknown>);
      this.policyText.set(JSON.stringify(saved.policies, null, 2));
      this.toast.show({
        tone: 'success',
        title: 'Policy guardada',
        description: 'La policy fue actualizada correctamente.',
      });
    } catch (e) {
      const msg = this.errorMessage(e) ?? 'Error al guardar policy';
      this.error.set(msg);
      this.toast.show({
        tone: 'danger',
        title: 'No se pudo guardar',
        description: msg,
      });
    } finally {
      this.isSaving.set(false);
    }
  }
}
