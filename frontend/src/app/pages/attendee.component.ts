import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, IngestResult } from '../services/api.service';

@Component({
  selector: 'app-attendee',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container">
      <h1>Ask a question</h1>
      <p class="muted">
        Submit as many as you like. Duplicate/near-duplicate questions are automatically
        merged into a single topic on the moderator board.
      </p>

      <div class="card">
        <textarea [(ngModel)]="text" rows="3"
                  placeholder="e.g. When will this year's dividend be paid?"></textarea>
        <div class="row" style="margin-top:12px">
          <label class="muted" style="flex:1">
            Shareholder weight (0–1)
            <input type="number" min="0" max="1" step="0.1" [(ngModel)]="weight" />
          </label>
          <button (click)="submit()" [disabled]="!text.trim() || busy">
            {{ busy ? 'Sending…' : 'Submit' }}
          </button>
        </div>
      </div>

      @if (last) {
        <div class="card">
          <div class="row">
            <span class="badge" [class.hot]="last.is_new_cluster">
              {{ last.is_new_cluster ? 'New topic' : 'Merged with existing topic' }}
            </span>
            <span class="muted">cluster size: {{ last.cluster_size }}</span>
            <span class="muted">similarity: {{ last.similarity }}</span>
          </div>
          <p class="muted" style="margin:8px 0 0">
            {{ last.is_new_cluster
                ? 'Nobody had asked this yet — a new topic was created.'
                : 'This matched a question others already asked, so it was deduplicated.' }}
          </p>
        </div>
      }
    </div>
  `,
})
export class AttendeeComponent implements OnInit {
  text = '';
  weight = 0.1;
  busy = false;
  last: IngestResult | null = null;
  private attendeeId = 'attendee-' + Math.floor(Math.random() * 1e6);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.login(this.attendeeId, 'ATTENDEE').subscribe((r) => this.api.setToken(r.token));
  }

  submit(): void {
    this.busy = true;
    this.api.submitQuestion(this.text.trim(), this.attendeeId, this.weight).subscribe({
      next: (res) => {
        this.last = res;
        this.text = '';
        this.busy = false;
      },
      error: () => {
        this.busy = false;
        alert('Could not submit — the server may be waking up (free tier). Try again in a moment.');
      },
    });
  }
}
