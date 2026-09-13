import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const SESSION_KEY = 'tailorhub-auth-session';
const TOKEN_KEY = 'tailorhub-auth-token';

/**
 * AuthSuccess — handles the OAuth redirect landing page.
 *
 * Security: The backend no longer puts a real JWT in the URL.
 * Instead it issues a short-lived opaque `code` param, which this
 * page exchanges for a real token via a POST request (code-exchange pattern).
 * This keeps JWTs out of browser history and server access logs.
 */
const AuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      const code = searchParams.get('code');

      if (!code) {
        toast.error('Authentication failed — no code returned.');
        navigate('/login');
        return;
      }

      try {
        // Exchange the opaque code for a real JWT
        const exchangeResp = await fetch(`${API_BASE_URL}/api/auth/oauth-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!exchangeResp.ok) {
          const err = await exchangeResp.json().catch(() => ({}));
          throw new Error(err.detail || 'Code exchange failed.');
        }

        const payload = await exchangeResp.json();
        const { access_token, user_id, email, full_name, role } = payload;

        // Store session identical to how AuthContext expects it
        localStorage.setItem(TOKEN_KEY, access_token);
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ access_token, user_id, email, full_name, role }),
        );

        toast.success('Successfully logged in!');
        // Hard reload so AuthContext bootstraps cleanly from localStorage
        const dest = role === 'admin' ? '/admin' : role === 'delivery' ? '/delivery' : '/';
        window.location.href = dest;
      } catch (err) {
        console.error('[AuthSuccess] OAuth code exchange error:', err);
        toast.error(err.message || 'Failed to complete sign-in. Please try again.');
        navigate('/login');
      }
    };

    processAuth();
  }, [searchParams, navigate]);

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 vw-100" style={{ background: 'var(--th-body-bg)' }}>
      <div className="d-flex flex-column align-items-center gap-3 anim-fade-up">
        <Loader2 size={40} className="text-accent anim-spin" />
        <p className="font-playfair fs-5">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;
