import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AppConfigService } from './core/config/app-config.service';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideAppInitializer(() => {
      const config = inject(AppConfigService);
      const theme = inject(ThemeService);

      return (async () => {
        await config.load();
        theme.applyTheme(config.get().THEME);
      })();
    }),
    provideRouter(routes)
  ]
};
