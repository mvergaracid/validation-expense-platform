import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ActionButtonComponent } from '../../atoms/action-button/action-button.component';

type WarningTone = 'warning' | 'danger';
type ToneToken = 'container' | 'badge' | 'icon' | 'description' | 'cancel' | 'confirm';

@Component({
  selector: 'app-warning-dialog',
  standalone: true,
  imports: [CommonModule, ActionButtonComponent],
  templateUrl: './warning-dialog.component.html'
})
export class WarningDialogComponent {
  @Input() title = 'Confirmar acción';
  @Input() description = '';
  @Input() confirmLabel = 'Aceptar';
  @Input() cancelLabel = 'Cancelar';
  @Input() disableBackdropClose = false;
  @Input() tone: WarningTone = 'warning';
  @Input() confirmDisabled = false;
  @Input() cancelDisabled = false;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly toneStyles: Record<WarningTone, Record<ToneToken, string>> = {
    warning: {
      container: 'border-[#b7e4a7] bg-[#f7ffe9] text-[#121f0f]',
      badge: 'bg-[#e5f8d6] text-[#355424]',
      icon: 'bg-[#d4f0bf] text-[#204017] border border-[#9cc48f]',
      description: 'text-[#3a4c32]',
      cancel: '!bg-[#e9f8da] !text-[#1d2c13] hover:!bg-[#ddf1c7]',
      confirm: '!bg-[#1f4219] !text-white hover:!bg-[#1a3714]'
    },
    danger: {
      container: 'border-[#f7c2c0] bg-[#fff4f3] text-[#3c0c0c]',
      badge: 'bg-[#fde0de] text-[#4c1212]',
      icon: 'bg-[#fbd0ce] text-[#4c1212] border border-[#e08a88]',
      description: 'text-[#5c1a1a]',
      cancel: '!bg-[#ffe8e6] !text-[#4c1212] hover:!bg-[#fdd8d6]',
      confirm: '!bg-[#7f1414] !text-white hover:!bg-[#680f0f]'
    }
  };

  protected toneClass(part: ToneToken): string {
    return this.toneStyles[this.tone][part];
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onDialogCancel(event: Event): void {
    event.preventDefault();
    if (this.disableBackdropClose) return;
    this.onCancel();
  }

  backdropClicked(): void {
    if (this.disableBackdropClose) return;
    this.onCancel();
  }
}
