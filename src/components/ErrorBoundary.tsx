import { Component } from "preact";
import type { ComponentChildren } from "preact";
import { uiLogger } from "../lib/logger";

interface ErrorBoundaryProps {
  children: ComponentChildren;
  fallback?: (error: Error, retry: () => void) => ComponentChildren;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Error boundary that catches rendering errors and displays fallback UI
 * Logs errors with structured logger for debugging
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  componentDidCatch(error: Error) {
    uiLogger.error("Component error caught by boundary", {
      error: error.message,
      stack: error.stack,
    });
    this.setState({ error });
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minBlockSize: "100dvh",
            gap: "var(--space-6)",
            padding: "var(--space-8)",
            background:
              "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
            color: "var(--color-text-primary)",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "2rem",
              color: "var(--color-attack)",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              maxWidth: "500px",
            }}
          >
            The application encountered an unexpected error. You can try
            reloading the page or returning to the main menu.
          </p>
          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <button
              onClick={this.retry}
              style={{
                padding: "var(--space-5) var(--space-7)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background:
                  "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
                color: "#fff",
                border: "2px solid var(--color-victory)",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.125rem",
                fontFamily: "inherit",
                boxShadow: "var(--shadow-lg)",
                borderRadius: "var(--radius-md)",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "var(--space-5) var(--space-7)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: "transparent",
                color: "var(--color-text-secondary)",
                border: "2px solid var(--color-border)",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.125rem",
                fontFamily: "inherit",
                borderRadius: "var(--radius-md)",
              }}
            >
              Reload Page
            </button>
          </div>
          {import.meta.env.DEV && (
            <details
              style={{
                marginTop: "var(--space-8)",
                padding: "var(--space-4)",
                background: "var(--color-bg-tertiary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                maxWidth: "600px",
                width: "100%",
                textAlign: "left",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  color: "var(--color-text-secondary)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                Error Details (Dev Only)
              </summary>
              <pre
                style={{
                  marginTop: "var(--space-4)",
                  padding: "var(--space-4)",
                  background: "var(--color-bg-secondary)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  color: "var(--color-attack)",
                  overflow: "auto",
                  maxHeight: "300px",
                }}
              >
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
