// Login with LINE through the LIFF SDK. The same flow works in the LINE app
// (LIFF browser, logged in automatically) and in a normal browser (redirects to LINE Login).
import liff from '@line/liff';
import { reactive } from 'vue';
import { api, ApiError } from './api';
import type { PublicConfig, User } from './types';

export const session = reactive({
  user: null as User | null,
  config: { liffId: '', devLogin: false } as PublicConfig,
  liffReady: false,
  error: '',
});

/** Run once before the app mounts. */
export async function bootstrapAuth(): Promise<void> {
  try {
    session.config = await api<PublicConfig>('/auth/config');
  } catch {
    session.error = 'Cannot reach the server.';
    return;
  }

  if (session.config.liffId) {
    try {
      // Also handles the LIFF redirect to /liff/drafts/<id> and the return from LINE Login
      await liff.init({ liffId: session.config.liffId });
      session.liffReady = true;
    } catch (err) {
      console.warn('LIFF init failed', err);
    }
  }

  try {
    session.user = await api<User>('/auth/me');
    return;
  } catch {
    session.user = null;
  }

  if (!session.liffReady) return;
  if (liff.isLoggedIn()) {
    await exchangeLiffToken();
  } else if (liff.isInClient()) {
    liff.login();
  }
}

async function exchangeLiffToken(): Promise<void> {
  const idToken = liff.getIDToken();
  if (!idToken) return;
  try {
    session.user = await api<User>('/auth/line', { method: 'POST', body: { idToken } });
    session.error = '';
  } catch (err) {
    session.error = err instanceof ApiError ? err.message : 'Login failed';
    // An expired token: clear LIFF login so the next click starts fresh
    if (err instanceof ApiError && err.status === 401) liff.logout();
  }
}

export function loginWithLine(): void {
  if (!session.liffReady) {
    session.error = 'LINE login is not configured (LIFF_ID missing).';
    return;
  }
  liff.login({ redirectUri: window.location.href });
}

export async function devLogin(): Promise<void> {
  session.user = await api<User>('/auth/dev', { method: 'POST' });
}

export async function logout(): Promise<void> {
  await api('/auth/logout', { method: 'POST' });
  if (session.liffReady && liff.isLoggedIn() && !liff.isInClient()) liff.logout();
  session.user = null;
}

export function inLineApp(): boolean {
  return session.liffReady && liff.isInClient();
}

export function closeLiff(): void {
  if (inLineApp()) liff.closeWindow();
}
