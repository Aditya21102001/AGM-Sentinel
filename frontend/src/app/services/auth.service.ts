import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';

export interface LoginResult {
  status: 'AUTHENTICATED' | 'MFA_REQUIRED';
  token: string | null;
  mfaToken: string | null;
  methods: string[] | null;
}
export interface MfaStatus { pin: boolean; totp: boolean; webauthn: boolean; }
export interface TotpInit { secret: string; qrDataUri: string; otpauthUri: string; }

/**
 * Authentication + MFA client. Owns the session (token/role/username as signals, persisted
 * to localStorage) and drives the WebAuthn browser ceremonies. Sets the token on ApiService
 * so the existing feature calls (board, submit, uploads) are authenticated.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = environment.apiBase;

  readonly token = signal<string | null>(localStorage.getItem('agm_token'));
  readonly role = signal<string | null>(localStorage.getItem('agm_role'));
  readonly username = signal<string | null>(localStorage.getItem('agm_user'));
  readonly isAuthenticated = computed(() => !!this.token());
  readonly isModerator = computed(() => {
    const r = this.role();
    return r === 'MODERATOR' || r === 'ADMIN';
  });

  constructor(private http: HttpClient, private api: ApiService) {
    if (this.token()) this.api.setToken(this.token()!);
  }

  // ---- session -----------------------------------------------------------
  completeLogin(token: string): void {
    const role = this.decodeRole(token) ?? 'MODERATOR';
    const user = this.decodeSubject(token) ?? '';
    this.token.set(token); this.role.set(role); this.username.set(user);
    localStorage.setItem('agm_token', token);
    localStorage.setItem('agm_role', role);
    localStorage.setItem('agm_user', user);
    this.api.setToken(token);
  }

  logout(): void {
    this.token.set(null); this.role.set(null); this.username.set(null);
    localStorage.removeItem('agm_token');
    localStorage.removeItem('agm_role');
    localStorage.removeItem('agm_user');
    this.api.setToken('');
  }

  private authHeaders(): Record<string, string> {
    const t = this.token();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  // ---- register / password login -----------------------------------------
  register(username: string, email: string, password: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/api/auth/register`, { username, email, password });
  }
  login(username: string, password: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.base}/api/auth/login`, { username, password });
  }
  verifyCode(mfaToken: string, method: 'pin' | 'totp', code: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.base}/api/auth/mfa/verify`, { mfaToken, method, code });
  }

  // ---- enrollment (needs a full access token) ----------------------------
  enrollStatus(): Observable<MfaStatus> {
    return this.http.get<MfaStatus>(`${this.base}/api/auth/enroll/status`, { headers: this.authHeaders() });
  }
  setPin(pin: string): Observable<MfaStatus> {
    return this.http.post<MfaStatus>(`${this.base}/api/auth/enroll/pin`, { pin }, { headers: this.authHeaders() });
  }
  totpInit(): Observable<TotpInit> {
    return this.http.post<TotpInit>(`${this.base}/api/auth/enroll/totp/init`, {}, { headers: this.authHeaders() });
  }
  totpEnable(code: string): Observable<MfaStatus> {
    return this.http.post<MfaStatus>(`${this.base}/api/auth/enroll/totp/enable`, { code }, { headers: this.authHeaders() });
  }

  // ---- WebAuthn passkey (biometric) --------------------------------------
  async enrollPasskey(): Promise<void> {
    const optionsText = await firstValueFrom(
      this.http.post(`${this.base}/api/auth/enroll/webauthn/start`, {}, {
        headers: this.authHeaders(), responseType: 'text',
      }));
    const options = JSON.parse(optionsText);
    const attResp = await startRegistration({ optionsJSON: options.publicKey });
    await firstValueFrom(this.http.post(`${this.base}/api/auth/enroll/webauthn/finish`,
      { credential: attResp }, { headers: this.authHeaders() }));
  }

  async loginPasskey(mfaToken: string): Promise<string> {
    const optionsText = await firstValueFrom(
      this.http.post(`${this.base}/api/auth/mfa/webauthn/start`, { mfaToken }, { responseType: 'text' }));
    const options = JSON.parse(optionsText);
    const asnResp = await startAuthentication({ optionsJSON: options.publicKey });
    const res = await firstValueFrom(this.http.post<{ token: string }>(
      `${this.base}/api/auth/mfa/webauthn/finish`, { mfaToken, credential: asnResp }));
    return res.token;
  }

  // ---- JWT helpers (read claims client-side; not for trust decisions) -----
  private decodeRole(token: string): string | null { return this.claim(token, 'role'); }
  private decodeSubject(token: string): string | null { return this.claim(token, 'sub'); }
  private claim(token: string, name: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload[name] ?? null;
    } catch {
      return null;
    }
  }
}
