import { render } from "preact";
import { inject } from "@vercel/analytics";
import App from "./App.tsx";
import "./index.css";

inject();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}
render(<App />, root);
