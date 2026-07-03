import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { ClusterView } from './api.service';

/**
 * Subscribes to the backend's STOMP topic `/topic/board` and exposes the live,
 * ranked, deduplicated cluster board as an observable the moderator view renders.
 */
@Injectable({ providedIn: 'root' })
export class BoardService {
  private client?: Client;
  readonly board$ = new BehaviorSubject<ClusterView[]>([]);
  readonly connected$ = new BehaviorSubject<boolean>(false);

  connect(): void {
    if (this.client?.active) return;

    this.client = new Client({
      // SockJS handles the fallback + works behind free-tier proxies.
      webSocketFactory: () => new SockJS(environment.wsUrl) as any,
      reconnectDelay: 4000,
      onConnect: () => {
        this.connected$.next(true);
        this.client!.subscribe('/topic/board', (msg: IMessage) => {
          const payload = JSON.parse(msg.body);
          this.board$.next(payload.clusters ?? []);
        });
      },
      onDisconnect: () => this.connected$.next(false),
      onWebSocketClose: () => this.connected$.next(false),
    });
    this.client.activate();
  }

  disconnect(): void {
    this.client?.deactivate();
    this.connected$.next(false);
  }
}
