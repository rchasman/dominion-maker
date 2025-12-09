import { render } from "preact";
import { injectSpeedInsights } from "@vercel/speed-insights";
import App from "./App.tsx";
import "./index.css";

// Initialize Vercel Speed Insights (client-side only)
injectSpeedInsights();

render(<App />, document.getElementById("root")!);
