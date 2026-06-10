const STORAGE_KEY = "irp_auth_token";

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
export function captureAuthTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("auth_token");
    if (token) {
      setAuthToken(token);
      url.searchParams.delete("auth_token");
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch {
    // Malformed URL or unavailable history API; ignore.
  }
}

export function redirectToLogin(): void {
  window.location.href = LOGIN_URL;
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}
