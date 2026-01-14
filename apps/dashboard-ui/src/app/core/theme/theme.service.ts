import { Injectable } from '@angular/core';

import type { ThemeConfig } from '../config/app-config.model';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  applyTheme(theme?: ThemeConfig): void {
    if (!theme) return;

    const root = document.documentElement;

    const map: Record<string, string | undefined> = {
      '--color-bg': theme.COLOR_BG,
      '--color-surface': theme.COLOR_SURFACE,
      '--color-border': theme.COLOR_BORDER,
      '--color-text': theme.COLOR_TEXT,
      '--color-text-muted': theme.COLOR_TEXT_MUTED,
      '--color-primary': theme.COLOR_PRIMARY,
      '--color-primary-fg': theme.COLOR_PRIMARY_FG,
      '--color-success': theme.COLOR_SUCCESS,
      '--color-success-fg': theme.COLOR_SUCCESS_FG,
      '--color-danger': theme.COLOR_DANGER,
      '--color-danger-fg': theme.COLOR_DANGER_FG
    };

    for (const [cssVar, value] of Object.entries(map)) {
      if (value) {
        root.style.setProperty(cssVar, value);
      }
    }
  }
}
