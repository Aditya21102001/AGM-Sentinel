import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav class="nav">
      <strong style="color:var(--accent)">🛡️ AGM Sentinel</strong>
      <a routerLink="/ask" routerLinkActive="active">Ask a question</a>
      <a routerLink="/board" routerLinkActive="active">Moderator board</a>
      <a routerLink="/setup" routerLinkActive="active">Setup</a>
    </nav>
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {}
