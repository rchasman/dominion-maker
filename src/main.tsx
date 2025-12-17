import { render } from "preact";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import App from "./App.tsx";
import "./index.css";
import { preloadCriticalImages } from "./lib/image-preload";

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
      .then((registration) => {
        console.log("[SW] Registered:", registration);
      })
      .catch((error) => {
        console.error("[SW] Registration failed:", error);
      });
  });
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}
render(<App />, root);
