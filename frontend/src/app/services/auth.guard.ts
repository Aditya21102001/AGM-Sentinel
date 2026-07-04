import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Protects moderator-only routes; redirects to /login when not signed in as a moderator. */
export const moderatorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isModerator() ? true : router.createUrlTree(['/login']);
};
