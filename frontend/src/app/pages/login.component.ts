import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container" style="max-width:460px">
      <h1>{{ mode() === 'register' ? 'Create moderator account' : 'Moderator sign in' }}</h1>

      @if (mode() !== 'mfa') {
        <div class="card">
          <label class="muted">Username
            <input [ngModel]="username()" (ngModelChange)="username.set($event)" autocomplete="username" />
          </label>
          @if (mode() === 'register') {
            <div class="hint">3–40 characters</div>
            <label class="muted" style="display:block;margin-top:10px">Email
              <input type="email" [ngModel]="email()" (ngModelChange)="email.set($event)"
                     placeholder="you@example.com" autocomplete="email" />
            </label>
            <div class="hint">A valid email, e.g. you@example.com</div>
          }
          <label class="muted" style="display:block;margin-top:10px">Password
            <input type="password" [ngModel]="password()" (ngModelChange)="password.set($event)"
                   autocomplete="current-password" />
          </label>
          @if (mode() === 'register') {
            <div class="hint">At least 8 characters</div>
          }
          <div class="row" style="margin-top:14px">
            <button (click)="submit()" [disabled]="busy() || !username() || !password()">
              {{ busy() ? '…' : (mode() === 'register' ? 'Register' : 'Sign in') }}
            </button>
            <span style="flex:1"></span>
            <a class="muted" style="cursor:pointer" (click)="toggleMode()">
              {{ mode() === 'register' ? 'Have an account? Sign in' : 'New moderator? Register' }}
            </a>
          </div>
        </div>
      }

      @if (mode() === 'mfa') {
        <div class="card">
          <p class="muted">Second factor required. Choose a method:</p>

          @if (methods().includes('webauthn')) {
            <button (click)="usePasskey()" [disabled]="busy()" style="width:100%;margin-bottom:12px">
              🔐 Use passkey / biometric (Windows Hello, Touch ID)
            </button>
          }

          @if (methods().includes('totp') || methods().includes('pin')) {
            <label class="muted">
              {{ methods().includes('totp') ? 'Authenticator code (or PIN)' : 'PIN' }}
              <input [ngModel]="code()" (ngModelChange)="code.set($event)" inputmode="numeric"
                     placeholder="123456" />
            </label>
            <div class="row" style="margin-top:12px">
              @if (methods().includes('totp')) {
                <button (click)="verify('totp')" [disabled]="busy() || !code()">Verify code</button>
              }
              @if (methods().includes('pin')) {
                <button (click)="verify('pin')" [disabled]="busy() || !code()">Verify PIN</button>
              }
            </div>
          }
        </div>
      }

      @if (error()) { <p class="error-box">⚠️ {{ error() }}</p> }
    </div>
  `,
})
export class LoginComponent {
  readonly mode = signal<'login' | 'register' | 'mfa'>('login');
  readonly username = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly code = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly methods = signal<string[]>([]);
  private mfaToken = '';

  constructor(private auth: AuthService, private router: Router) {}

  toggleMode(): void {
    this.error.set('');
    this.mode.set(this.mode() === 'register' ? 'login' : 'register');
  }

  submit(): void {
    this.busy.set(true); this.error.set('');
    const req = this.mode() === 'register'
      ? this.auth.register(this.username(), this.email(), this.password())
      : this.auth.login(this.username(), this.password());
    req.subscribe({
      next: (r) => {
        this.busy.set(false);
        if (r.status === 'AUTHENTICATED' && r.token) {
          this.auth.completeLogin(r.token);
          this.router.navigate([this.mode() === 'register' ? '/security' : '/board']);
        } else {
          this.mfaToken = r.mfaToken ?? '';
          this.methods.set(r.methods ?? []);
          this.mode.set('mfa');
        }
      },
      error: (e) => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  verify(method: 'pin' | 'totp'): void {
    this.busy.set(true); this.error.set('');
    this.auth.verifyCode(this.mfaToken, method, this.code()).subscribe({
      next: (r) => { this.auth.completeLogin(r.token); this.router.navigate(['/board']); },
      error: (e) => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  async usePasskey(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      const token = await this.auth.loginPasskey(this.mfaToken);
      this.auth.completeLogin(token);
      this.router.navigate(['/board']);
    } catch (e: any) {
      this.busy.set(false);
      this.error.set('Passkey login failed or cancelled.');
    }
  }

  private msg(e: any): string {
    return e?.error?.message || e?.error?.error || 'Something went wrong. Try again.';
  }
}
