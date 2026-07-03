import { Routes } from '@angular/router';
import { AttendeeComponent } from './pages/attendee.component';
import { ModeratorComponent } from './pages/moderator.component';

export const routes: Routes = [
  { path: '', redirectTo: 'ask', pathMatch: 'full' },
  { path: 'ask', component: AttendeeComponent },
  { path: 'board', component: ModeratorComponent },
];
