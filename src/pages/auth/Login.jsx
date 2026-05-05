import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, Lock, Loader2, LogIn, Github } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <div className="auth-header">
          <div className="auth-logo">
            <LogIn size={32} className="text-accent" />
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your WhatsApp CRM dashboard</p>
        </div>

        {error && (
          <div className="form-error auth-error-box">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="search-bar">
              <Mail size={18} className="search-bar-icon" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={error ? 'error' : ''}
              />
            </div>
          </div>

          <div className="form-group">
            <div className="form-label">
              <span>Password</span>
              <Link to="/auth/forgot-password" size="sm" className="text-accent text-xs">Forgot password?</Link>
            </div>
            <div className="search-bar">
              <Lock size={18} className="search-bar-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={error ? 'error' : ''}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR CONTINUE WITH</span>
        </div>

        <div className="auth-social-grid">
          <button className="btn btn-secondary w-full" type="button">
            <Github size={18} />
            <span>GitHub</span>
          </button>
        </div>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-accent font-semibold">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: var(--bg-app);
          padding: var(--space-xl);
          background-image: radial-gradient(circle at 0% 0%, rgba(16, 185, 129, 0.05) 0%, transparent 50%),
                            radial-gradient(circle at 100% 100%, rgba(16, 185, 129, 0.05) 0%, transparent 50%);
        }

        .auth-card {
          width: 100%;
          max-width: 440px;
          padding: var(--space-2xl) !important;
        }

        .auth-header {
          text-align: center;
          margin-bottom: var(--space-2xl);
        }

        .auth-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          margin-bottom: var(--space-xl);
          box-shadow: var(--shadow-md);
        }

        .auth-title {
          font-size: var(--font-size-2xl);
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: var(--space-xs);
          color: var(--text-primary);
        }

        .auth-subtitle {
          color: var(--text-secondary);
          font-size: var(--font-size-sm);
        }

        .auth-error-box {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: var(--space-md);
          border-radius: var(--radius-lg);
          margin-bottom: var(--space-xl);
          text-align: center;
        }

        .auth-form {
          margin-bottom: var(--space-xl);
        }

        .auth-divider {
          display: flex;
          align-items: center;
          margin: var(--space-xl) 0;
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border-subtle);
        }

        .auth-divider span {
          padding: 0 var(--space-md);
        }

        .auth-social-grid {
          margin-bottom: var(--space-xl);
        }

        .auth-footer {
          text-align: center;
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }

        .w-full {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
