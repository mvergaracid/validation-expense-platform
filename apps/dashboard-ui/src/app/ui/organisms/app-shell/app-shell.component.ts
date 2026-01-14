import { CommonModule } from '@angular/common';
import { Component, HostListener, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ActionButtonComponent } from '../../atoms/action-button/action-button.component';
import { ToastStackComponent } from '../../molecules/toast-stack/toast-stack.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ActionButtonComponent, ToastStackComponent],
  templateUrl: './app-shell.component.html'
})
export class AppShellComponent {
  protected readonly isSidebarOpen = signal(true);

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isSidebarOpen()) {
      event.preventDefault();
      this.closeSidebar();
    }
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }
}
