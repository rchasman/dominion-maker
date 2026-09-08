import { render } from "preact";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import App from "./App.tsx";
import "./index.css";
import { preloadCriticalImages } from "./lib/image-preload";
import { uiLogger } from "./lib/logger";

// Initialize Vercel Analytics and Speed Insights
inject();
injectSpeedInsights();

// Preload critical card images for faster initial render
preloadCriticalImages();

// Register service worker for aggressive card caching
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(registration => {
        uiLogger.info("Service worker registered", {
          scope: registration.scope,
        });
      })
      .catch(error => {
        uiLogger.error("Service worker registration failed", { error });
      });
  });
}

// A deploy replaces every hashed chunk. Tabs opened before the deploy still
// reference the old hashes, so their first lazy import 404s. Reload to pick
// up the new index instead of surfacing a dead tooltip as an app crash.
window.addEventListener("vite:preloadError", event => {
  event.preventDefault();
  uiLogger.warn("Stale chunk after deploy, reloading", {
    error: event.payload.message,
  });
  window.location.reload();
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

import { ErrorBoundary } from "./components/ErrorBoundary";

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  root,
);
