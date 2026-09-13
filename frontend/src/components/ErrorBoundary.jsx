import React from 'react';
import { Button } from '@/components/ui/button';

/**
 * ErrorBoundary — catches unhandled render errors and shows a fallback UI
 * instead of crashing the entire SPA.
 *
 * Usage: wrap <App /> or any subtree with <ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production you'd send this to Sentry / Datadog
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="d-flex align-items-center justify-content-center min-vh-100"
          style={{ background: 'var(--th-body-bg, #f8f9fa)' }}
        >
          <div className="text-center px-4" style={{ maxWidth: 480 }}>
            {/* Icon */}
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-4"
              style={{ width: 72, height: 72, background: '#fee2e2' }}
            >
              <span style={{ fontSize: 32 }}>⚠️</span>
            </div>

            <h2 className="fw-bold mb-2" style={{ color: '#dc2626' }}>
              Something went wrong
            </h2>
            <p className="text-muted mb-4">
              An unexpected error occurred. Our team has been notified. Please try
              refreshing the page.
            </p>

            {/* Error details in dev mode */}
            {import.meta.env.DEV && this.state.error && (
              <pre
                className="text-start p-3 rounded mb-4"
                style={{
                  background: '#1e1e2e',
                  color: '#f38ba8',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  maxHeight: 200,
                }}
              >
                {this.state.error.toString()}
              </pre>
            )}

            <Button onClick={this.handleReset}>
              Go to Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
