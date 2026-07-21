import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("LuminaNT render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full flex items-center justify-center p-8">
          <div className="glass-strong rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h1 className="text-lg font-semibold text-loss">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The UI crashed while rendering. Try reloading. If it keeps happening,
              clear filters or reconnect the tracker folder.
            </p>
            <pre className="text-xs font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-40 text-loss/90">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  this.setState({ error: null });
                  window.location.reload();
                }}
              >
                Reload app
              </Button>
              <Button
                variant="outline"
                onClick={() => this.setState({ error: null })}
              >
                Try continue
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
