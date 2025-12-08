import { treaty } from "@elysiajs/eden";
import type { App } from "../../server";

// Use same-origin API calls to avoid CORS issues
// In production/preview: use window.location.origin (same deployment)
// In development: use localhost:5174 (separate server)
const API_URL = import.meta.env.DEV
  ? "http://localhost:5174"
  : typeof window !== "undefined"
    ? window.location.origin
    : "https://dominion-maker.vercel.app";

export const api = treaty<App>(API_URL);
