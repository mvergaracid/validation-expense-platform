import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

@Component({
  selector: 'app-action-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-button.component.html'
})
export class ActionButtonComponent {
  @Input({ required: true }) label!: string;
  @Input() variant: ActionButtonVariant = 'secondary';
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
  @Input() ariaLabel?: string;
  @Input() extraClass?: string;

  @Output() pressed = new EventEmitter<void>();

  buttonClass(): string {
    const base =
      'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm border transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

    switch (this.variant) {
      case 'primary':
        return `${base} border-primary bg-primary text-primary-fg hover:brightness-110`;
      case 'danger':
        return `${base} border-danger bg-danger text-danger-fg hover:brightness-110`;
      case 'ghost':
        return `${base} border-transparent bg-transparent text-text hover:bg-surface-2`;
      case 'secondary':
      default:
        return `${base} border-border bg-surface text-text hover:bg-surface-2`;
    }
  }

  mergedClass(): string {
    return `${this.buttonClass()}${this.extraClass ? ` ${this.extraClass}` : ''}`;
  }

  onClick(): void {
    if (this.disabled) return;
    this.pressed.emit();
  }
}
