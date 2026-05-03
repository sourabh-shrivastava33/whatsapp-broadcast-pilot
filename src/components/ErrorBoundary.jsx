import React from 'react';
import { AlertCircle, RefreshCw, Home, ChevronRight } from 'lucide-react';
import { Button } from './ui/Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Frontend Error Caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-page">
          <style>{`
            .error-boundary-page {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              width: 100vw;
              background: var(--bg-app);
              padding: var(--space-xl);
              text-align: center;
              color: var(--text-primary);
              font-family: var(--font-family);
            }
            .error-card {
              max-width: 500px;
              background: var(--bg-card);
              border: 1px solid var(--border-subtle);
              border-radius: var(--radius-lg);
              padding: var(--space-xl);
              box-shadow: var(--shadow-lg);
              animation: slideUp 0.5s ease-out;
            }
            @keyframes slideUp {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .error-icon-wrapper {
              width: 64px;
              height: 64px;
              background: var(--accent-dim);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: var(--space-lg);
              color: var(--status-rejected);
            }
            .error-title {
              font-size: 24px;
              font-weight: 700;
              margin-bottom: var(--space-sm);
              color: var(--text-primary);
            }
            .error-message {
              color: var(--text-secondary);
              font-size: 15px;
              line-height: 1.6;
              margin-bottom: var(--space-xl);
            }
            .error-actions {
              display: flex;
              gap: var(--space-md);
              justify-content: center;
            }
            .error-details {
              margin-top: var(--space-xl);
              text-align: left;
              background: var(--bg-input);
              border-radius: var(--radius-md);
              padding: var(--space-md);
              font-family: monospace;
              font-size: 12px;
              max-height: 200px;
              overflow-y: auto;
              color: var(--status-rejected);
              border: 1px solid var(--border-subtle);
            }
            .error-details summary {
              cursor: pointer;
              color: var(--text-muted);
              margin-bottom: 8px;
              outline: none;
            }
            .error-details summary:hover {
              color: var(--text-secondary);
            }
          `}</style>

          <div className="error-card">
            <div className="error-icon-wrapper">
              <AlertCircle size={32} />
            </div>
            <h1 className="error-title">Something went wrong</h1>
            <p className="error-message">
              We encountered an unexpected error while rendering this page. Our team has been notified.
              Please try refreshing the page or going back to the dashboard.
            </p>
            
            <div className="error-actions">
              <Button 
                variant="primary" 
                icon={RefreshCw} 
                onClick={this.handleReset}
              >
                Reload Page
              </Button>
              <Button 
                variant="ghost" 
                icon={Home} 
                onClick={() => window.location.href = '/'}
              >
                Go Dashboard
              </Button>
            </div>

            {this.state.error && (
              <details className="error-details">
                <summary>Technical Details</summary>
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                  {this.state.error.toString()}
                </div>
                <pre style={{ whiteSpace: 'pre-wrap' }}>
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
