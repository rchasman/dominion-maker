import { treaty } from "@elysiajs/eden";
import type { App } from "../../server";

const API_URL = import.meta.env.VITE_VERCEL_URL
  ? `https://${import.meta.env.VITE_VERCEL_URL}`
  : "http://localhost:5174";

export const api = treaty<App>(API_URL);
