import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

@Component({
  selector: 'app-select-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './select-input.component.html',
})
export class SelectInputComponent<T extends string> {
  @Input({ required: true }) value!: T;
  @Input({ required: true }) options!: Array<SelectOption<T>>;
  @Input() disabled = false;
  @Input() ariaLabel?: string;
  @Input() extraClass?: string;

  @Output() changed = new EventEmitter<T>();

  mergedClass(): string {
    const base =
      'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed';
    return `${base}${this.extraClass ? ` ${this.extraClass}` : ''}`;
  }

  onChange(evt: Event): void {
    const target = evt.target as HTMLSelectElement | null;
    if (!target) return;
    this.changed.emit(target.value as T);
  }
}
