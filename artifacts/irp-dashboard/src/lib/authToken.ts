const STORAGE_KEY = "irp_auth_token";

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
