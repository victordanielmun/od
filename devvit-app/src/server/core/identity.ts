/**
 * Identity — the Devvit replacement for the old JWT/auth layer. There is no login, password,
 * or guest flow: the current user IS the Reddit user viewing the post (`context.userId`).
 */
import { context, reddit } from '@devvit/web/server';
import { HttpError } from './http.js';
import { ensureProfile } from '../repos/userRepo.js';
import type { UserProfile } from '../../shared/types.js';

export interface CurrentUser {
  userId: string;
  username: string;
}

/** The logged-in Reddit user, or null when the viewer is anonymous/logged out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = context.userId;
  if (!userId) return null;
  const username = (await reddit.getCurrentUsername()) ?? 'anon';
  return { userId, username };
}

/** Require a logged-in user and guarantee their profile exists. Throws 401 otherwise. */
export async function requireUser(): Promise<{ user: CurrentUser; profile: UserProfile }> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'You must be logged in to Reddit to play.');
  const profile = await ensureProfile(user.userId, user.username);
  return { user, profile };
}
