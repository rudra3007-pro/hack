import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#12100E] text-[#FAF5EE] p-6">
          <div className="max-w-md w-full rounded-2xl border border-[#2E2924] bg-[#1C1916] p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D62828]/20 text-[#D62828]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold">Something went wrong</h2>
                <p className="text-xs text-[#C4B9AC]">MargFlow recovered safely from a runtime error.</p>
              </div>
            </div>
            <pre className="rounded-xl border border-[#2E2924] bg-[#12100E] p-3 text-[11px] font-mono text-amber-200 overflow-x-auto whitespace-pre-wrap">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#E85D04] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#D65202]"
            >
              <RotateCcw className="h-4 w-4" />
              Reload MargFlow
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
