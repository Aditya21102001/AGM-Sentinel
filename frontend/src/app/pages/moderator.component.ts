import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ApiService, ClusterView } from '../services/api.service';
import { BoardService } from '../services/board.service';

@Component({
  selector: 'app-moderator',
  standalone: true,
  template: `
    <div class="container">
      <div class="row">
        <h1 style="flex:1">Moderator board</h1>
        <span class="badge" [class.hot]="!board.connected()">
          {{ board.connected() ? 'live' : 'connecting…' }}
        </span>
      </div>
      <p class="muted">
        Questions ranked by how many people asked × shareholder weight. Updates in real time.
      </p>

      @if (board.board().length === 0) {
        <div class="card muted">No questions yet. Open the “Ask a question” tab and submit a few.</div>
      }

      @for (c of board.board(); track c.cluster_id) {
        <div class="card">
          <div class="q">{{ c.representative_question }}</div>
          <div class="row">
            <span class="badge" [class.hot]="c.size >= 3">{{ c.size }} asked</span>
            <span class="muted">priority {{ c.priority_score }}</span>
            <span style="flex:1"></span>
            <button (click)="draft(c)" [disabled]="drafting().has(c.cluster_id)">
              {{ drafting().has(c.cluster_id) ? 'Drafting…' : 'Draft answer' }}
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
  readonly drafting = signal<Set<string>>(new Set());

  constructor(private api: ApiService, protected board: BoardService) {}

  ngOnInit(): void {
    // Moderator needs a MODERATOR-role token to hit /api/clusters.
    this.api.login('moderator-1', 'MODERATOR').subscribe((r) => {
      this.api.setToken(r.token);
      this.api.getBoard().subscribe((b) => this.board.board.set(b)); // initial snapshot
      this.board.connect();                                          // then live pushes
    });
  }

  draft(c: ClusterView): void {
    this.mutateDrafting((s) => s.add(c.cluster_id));
    this.api.requestDraft(c.cluster_id, c.representative_question).subscribe({
      next: () => this.mutateDrafting((s) => s.delete(c.cluster_id)),
      error: () => this.mutateDrafting((s) => s.delete(c.cluster_id)),
    });
  }

  /** Signals need a new reference to notify; clone the Set on each change. */
  private mutateDrafting(fn: (s: Set<string>) => void): void {
    const next = new Set(this.drafting());
    fn(next);
    this.drafting.set(next);
  }

  ngOnDestroy(): void {
    this.board.disconnect();
  }
}
