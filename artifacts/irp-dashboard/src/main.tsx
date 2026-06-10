import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import { captureAuthTokenFromUrl, getAuthToken } from "./lib/authToken";
import "./index.css";

// Pick up the SSO token from the redirect, then attach it to every API call so
// the backend can re-verify it and resolve the current user.
captureAuthTokenFromUrl();
setAuthTokenGetter(() => getAuthToken());

createRoot(document.getElementById("root")!).render(<App />);
