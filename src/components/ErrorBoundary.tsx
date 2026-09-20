import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  declare state: State;
  declare setState: (state: Partial<State> | ((prevState: State) => Partial<State>)) => void;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SwasthAI ErrorBoundary] Uncaught runtime exception:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-[#FAF9F6] p-4 text-[#1F2421]">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-gray-200 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
              <p className="text-xs text-gray-500">
                SwasthAI encountered an unexpected application runtime condition.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow-md hover:bg-[#166534] transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry Action</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-100 hover:bg-gray-200 border border-gray-300 py-2.5 text-xs font-bold text-gray-700 transition-all"
              >
                <Home className="h-4 w-4" />
                <span>Reload Application</span>
              </button>
            </div>

            <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
              Technical details logged safely for debugging.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
