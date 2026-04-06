import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../state/AuthContext';

const LoginPage = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      const nextPath = (location.state as { from?: string } | null)?.from || '/events';
      navigate(nextPath, { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to sign in.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell login-shell">
      <header className="brand-header brand-header-centered">
        <div className="brand-title"><span className="brand-mark">RDX</span> Check In</div>
      </header>

      <section className="auth-card login-card">
        <form onSubmit={onSubmit} className="auth-form login-form">
          <label>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="email" required />
          </label>
          <label>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="password" required />
          </label>
          {error ? <p className="inline-error">{error}</p> : null}
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'sign in'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default LoginPage;