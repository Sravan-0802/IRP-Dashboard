import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import {
  captureAuthTokenFromUrl,
  ensureAuthenticated,
  getAuthToken,
  restoreDestinationAfterLogin,
} from "./lib/authToken";
import { maybeResetL1RegistrationFromUrl } from "./lib/l1AssessmentSchedule";
import "./index.css";

// Pick up the SSO token from the redirect, then attach it to every API call so
// the backend can re-verify it and resolve the current user.
const justAuthenticated = captureAuthTokenFromUrl();

// The SSO round-trip drops users at the root, so after login send them back to
// the page they originally opened (e.g. a shared /assessments-hub link).
if (!restoreDestinationAfterLogin(justAuthenticated)) {
  void maybeResetL1RegistrationFromUrl().then((didReset) => {
    if (didReset) window.location.reload();
  });

  const isAnalyticsPage = window.location.pathname.startsWith("/analytics");

  if (isAnalyticsPage || ensureAuthenticated()) {
    setAuthTokenGetter(() => getAuthToken());
    createRoot(document.getElementById("root")!).render(<App />);
  }
}
