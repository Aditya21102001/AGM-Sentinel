import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface IngestResult {
  question_id: string;
  cluster_id: string;
  is_new_cluster: boolean;
  similarity: number;
  cluster_size: number;
}

export interface ClusterView {
  cluster_id: string;
  representative_question: string;
  size: number;
  priority_score: number;
  draft: string | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private token: string | null = null;

  constructor(private http: HttpClient) {}

  /** Grab a demo JWT for the given role so protected endpoints work. */
  login(username: string, role: 'ATTENDEE' | 'MODERATOR'): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(
      `${environment.apiBase}/api/auth/login`,
      { username, role },
    );
  }

  setToken(token: string) {
    this.token = token;
  }

  private authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  submitQuestion(text: string, attendeeId: string, weight: number): Observable<IngestResult> {
    return this.http.post<IngestResult>(
      `${environment.apiBase}/api/questions`,
      { text, attendeeId, weight },
      { headers: this.authHeaders() },
    );
  }

  getBoard(): Observable<ClusterView[]> {
    return this.http.get<ClusterView[]>(`${environment.apiBase}/api/clusters`, {
      headers: this.authHeaders(),
    });
  }

  requestDraft(clusterId: string, representativeQuestion: string): Observable<unknown> {
    return this.http.post(
      `${environment.apiBase}/api/clusters/${clusterId}/draft`,
      { representativeQuestion },
      { headers: this.authHeaders() },
    );
  }
}
