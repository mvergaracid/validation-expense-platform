import { Routes } from '@angular/router';

import { AppShellComponent } from './ui/organisms/app-shell/app-shell.component';
import { ProcessMonitorPageComponent } from './pages/process-monitor/process-monitor-page.component';
import { PoliciesPageComponent } from './pages/settings/policies/policies-page.component';
import { CachePageComponent } from './pages/settings/cache/cache-page.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'process_batch' },
      { path: 'process_batch', component: ProcessMonitorPageComponent },
      { path: 'settings/policies', component: PoliciesPageComponent },
      { path: 'settings/cache', component: CachePageComponent },
    ],
  },
];
