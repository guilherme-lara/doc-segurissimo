import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error.message, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center rounded-2xl border border-destructive/20 bg-destructive/5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {this.props.fallbackMessage ?? "Algo deu errado 😔"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Um erro inesperado ocorreu neste componente.
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={this.handleRetry}>
            <RefreshCw className="mr-2 h-3 w-3" /> Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
