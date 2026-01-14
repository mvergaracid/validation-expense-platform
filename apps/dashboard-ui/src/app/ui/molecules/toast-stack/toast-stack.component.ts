import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { ToastService, ToastTone } from './toast.service';

@Component({
  selector: 'app-toast-stack',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-stack.component.html'
})
export class ToastStackComponent {
  private readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;

  protected dismiss(id: string): void {
    this.toastService.dismiss(id);
  }

  protected toneClass(tone: ToastTone): string {
    switch (tone) {
      case 'success':
        return 'border-[#a9f0c1] bg-[#f2fff7]/95 text-[#05290f]';
      case 'danger':
        return 'border-[#ffb4b4] bg-[#fff5f5]/95 text-[#3b0b0b]';
      default:
        return 'border-border bg-surface text-text';
    }
  }

  protected badgeClass(tone: ToastTone): string {
    switch (tone) {
      case 'success':
        return 'bg-[#c7f7da] text-[#0f3d1d]';
      case 'danger':
        return 'bg-[#ffd8d8] text-[#5a1313]';
      default:
        return 'bg-surface-2 text-text';
    }
  }
}
