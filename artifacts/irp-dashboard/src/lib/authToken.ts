const STORAGE_KEY = "irp_auth_token";
/** Path the user originally requested, stashed across the SSO round-trip. */
const POST_LOGIN_PATH_KEY = "irp_post_login_path";

/** SSO login page — users land here when visiting the dashboard without a token. */
export const LOGIN_URL =
  import.meta.env.VITE_LOGIN_URL ?? "https://meetings.ccbp.in/mid/irp_dashboard";

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable (e.g. private mode); ignore.
  }
}

/**
 * Reads the `auth_token` handed over by the SSO redirect, persists it for the
 * session, and removes it from the URL so it isn't shared or bookmarked.
 */
export function captureAuthTokenFromUrl(): boolean {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("auth_token");
    if (token) {
      setAuthToken(token);
      url.searchParams.delete("auth_token");
      window.history.replaceState({}, document.title, url.toString());
      return true;
    }
  } catch {
    // Malformed URL or unavailable history API; ignore.
  }
  return false;
}

export function redirectToLogin(): void {
  // Remember where the user was headed (e.g. a shared /assessments-hub link) so
  // we can return them there after the SSO round-trip drops them at the root.
  try {
    const { pathname, search, hash } = window.location;
    sessionStorage.setItem(POST_LOGIN_PATH_KEY, pathname + search + hash);
  } catch {
    // Storage may be unavailable; fall back to the default landing page.
  }
  window.location.href = LOGIN_URL;
}

/**
 * After returning from SSO, send the user back to the page they originally
 * requested. Returns true when a navigation was triggered, in which case the
 * caller should stop booting the app (the page is about to reload).
 */
export function restoreDestinationAfterLogin(justAuthenticated: boolean): boolean {
  if (!justAuthenticated) return false;
  let target: string | null = null;
  try {
    target = sessionStorage.getItem(POST_LOGIN_PATH_KEY);
    if (target) sessionStorage.removeItem(POST_LOGIN_PATH_KEY);
  } catch {
    return false;
  }
  if (!target) return false;
  // Only restore same-origin paths (leading single slash) to avoid off-site redirects.
  if (!target.startsWith("/") || target.startsWith("//")) return false;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (target === current) return false;
  window.location.replace(target);
  return true;
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}

/** Production builds require SSO; dev can use the API server's ACADEMY_USER_ID fallback. */
export function shouldRequireSsoLogin(): boolean {
  if (import.meta.env.VITE_SSO_REQUIRED === "false") return false;
  return import.meta.env.PROD;
}

/** Send unauthenticated production visitors to the IRP Dashboard SSO meeting link. */
export function ensureAuthenticated(): boolean {
  if (!shouldRequireSsoLogin() || hasAuthToken()) return true;
  redirectToLogin();
  return false;
}
