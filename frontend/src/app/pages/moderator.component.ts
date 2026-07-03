import { Component, OnDestroy, OnInit } from '@angular/core';
import { ApiService, ClusterView } from '../services/api.service';
import { BoardService } from '../services/board.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-moderator',
  standalone: true,
  template: `
    <div class="container">
      <div class="row">
        <h1 style="flex:1">Moderator board</h1>
        <span class="badge" [class.hot]="!connected">
          {{ connected ? 'live' : 'connecting…' }}
        </span>
      </div>
      <p class="muted">
        Questions ranked by how many people asked × shareholder weight. Updates in real time.
      </p>

      @if (clusters.length === 0) {
        <div class="card muted">No questions yet. Open the “Ask a question” tab and submit a few.</div>
      }

      @for (c of clusters; track c.cluster_id) {
        <div class="card">
          <div class="q">{{ c.representative_question }}</div>
          <div class="row">
            <span class="badge" [class.hot]="c.size >= 3">{{ c.size }} asked</span>
            <span class="muted">priority {{ c.priority_score }}</span>
            <span style="flex:1"></span>
            <button (click)="draft(c)" [disabled]="drafting.has(c.cluster_id)">
              {{ drafting.has(c.cluster_id) ? 'Drafting…' : 'Draft answer' }}
            </button>
          </div>
          @if (c.draft) {
            <div class="draft">{{ c.draft }}</div>
          }
        </div>
      }
    </div>
  `,
})
export class ModeratorComponent implements OnInit, OnDestroy {
  clusters: ClusterView[] = [];
  connected = false;
  drafting = new Set<string>();
  private subs: Subscription[] = [];

  constructor(private api: ApiService, private board: BoardService) {}

  ngOnInit(): void {
    // Moderator needs a MODERATOR-role token to hit /api/clusters.
    this.api.login('moderator-1', 'MODERATOR').subscribe((r) => {
      this.api.setToken(r.token);
      this.api.getBoard().subscribe((b) => (this.clusters = b)); // initial snapshot
      this.board.connect();                                       // then live pushes
    });

    this.subs.push(this.board.board$.subscribe((b) => (this.clusters = b)));
    this.subs.push(this.board.connected$.subscribe((c) => (this.connected = c)));
  }

  draft(c: ClusterView): void {
    this.drafting.add(c.cluster_id);
    this.api.requestDraft(c.cluster_id, c.representative_question).subscribe({
      next: () => this.drafting.delete(c.cluster_id),
      error: () => this.drafting.delete(c.cluster_id),
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.board.disconnect();
  }
}
