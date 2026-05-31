import React from "react";
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { Scissors, User, Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(null);

  // OTP verification state
  const [showOTP, setShowOTP] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  const { signIn, signUp, verifyEmail, resendOTP, pendingVerification, user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectByRole = (role) => {
    if (location.state?.from) {
      window.location.href = location.state.from;
    } else {
      const dest = role === 'admin' ? '/admin' : role === 'delivery' ? '/delivery' : '/';
      window.location.href = dest;
    }
  };

  // Redirect already-authenticated users away from login (unless verifying OTP)
  useEffect(() => {
    if (!authLoading && user && !showOTP) {
      redirectByRole(roles[0] || 'customer');
    }
  }, [authLoading, user, showOTP, roles]);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error');
    if (error === 'oauth_mismatch' || error === 'oauth_failed') {
      toast.error("Social login failed. Please try again or use email/password.");
    } else if (error) {
      toast.error(`Authentication error: ${error}`);
    }
  }, []);

  // Show OTP screen when pendingVerification is set
  useEffect(() => {
    if (pendingVerification?.email) {
      setOtpEmail(pendingVerification.email);
      setShowOTP(true);
    }
  }, [pendingVerification]);

  const handleSocialLogin = (provider) => {
    const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
    window.location.href = `${API_BASE_URL}/api/auth/${provider}/login`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (isSignup) {
      const { error, data, needsVerification } = await signUp(email, password, fullName, 'customer');
      if (error) {
        toast.error(error.message);
      } else if (needsVerification) {
        setOtpEmail(email);
        setShowOTP(true);
        toast.success('Account created! Please verify your email.');
      } else {
        toast.success('Account created successfully.');
        redirectByRole(data?.role || 'customer');
      }
    } else {
      const { error, data, needsVerification } = await signIn(email, password);
      if (error) {
        if (needsVerification) {
          setOtpEmail(email);
          setShowOTP(true);
          toast.warning(error.message);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Welcome back!');
        redirectByRole(data?.role || 'customer');
      }
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error, activatedRole } = await verifyEmail(otpEmail, otpCode);
    if (error) {
      toast.error(error.message);
    } else {
      setVerified(true);
      toast.success('Email verified successfully!');
      setTimeout(() => {
        if (activatedRole) {
          // signUp flow: token was activated, redirect directly
          redirectByRole(activatedRole);
        } else {
          // signIn unverified flow: no token, show login form
          setShowOTP(false);
          setVerified(false);
          setOtpCode('');
          setIsSignup(false);
          setEmail(otpEmail);
          toast.info('Please sign in with your email and password.');
        }
      }, 1200);
    }
    setLoading(false);
  };

  const handleResendOTP = async () => {
    setResending(true);
    const { error, data } = await resendOTP(otpEmail);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(data?.message || 'New code sent!');
    }
    setResending(false);
  };

  // ── OTP Verification Screen ──────────────────────────────────────────────
  if (showOTP) {
    return (
      <Layout>
        <div className="d-flex align-items-center justify-content-center px-3 py-5" style={{ minHeight: '80vh' }}>
          <div className="th-card-static p-0 anim-scale-in position-relative" style={{ maxWidth: 440, width: '100%' }}>
            
            {verified && (
              <div className="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center" style={{ background: 'rgba(255,255,255,0.95)', zIndex: 10, borderRadius: 'var(--th-radius)' }}>
                <CheckCircle2 size={56} className="text-success mb-3" />
                <h5 className="font-playfair fw-bold mb-1">Email Verified!</h5>
                <p className="text-muted small">Redirecting...</p>
              </div>
            )}

            {/* Header */}
            <div className="text-center p-4 pb-2">
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 48, height: 48, background: 'var(--th-accent-light)' }}>
                <Mail size={24} className="text-accent" />
              </div>
              <h4 className="font-playfair fw-bold">Verify Your Email</h4>
              <p className="text-muted small">
                We sent a 6-digit code to <strong>{otpEmail}</strong>
              </p>
            </div>

            {/* OTP Form */}
            <div className="p-4 pt-0">
              <form onSubmit={handleVerifyOTP}>
                <div className="mb-4">
                  <label className="th-label" htmlFor="otp-code">Verification Code</label>
                  <input
                    id="otp-code"
                    type="text"
                    className="th-input text-center fw-bold"
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    style={{ fontSize: '1.4rem', letterSpacing: '0.3em' }}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-accent w-100 d-flex align-items-center justify-content-center gap-2"
                  disabled={loading || otpCode.length !== 6}
                >
                  {loading && <Loader2 size={16} className="anim-spin" />}
                  Verify Email
                </button>

                <div className="text-center mt-3">
                  <p className="text-muted small mb-2">Didn't receive the code?</p>
                  <button
                    type="button"
                    className="btn btn-link p-0 text-accent fw-medium text-decoration-none small"
                    onClick={handleResendOTP}
                    disabled={resending}
                  >
                    {resending ? 'Sending...' : 'Resend Code'}
                  </button>
                </div>

                <hr className="my-3" />
                
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2"
                  onClick={() => { setShowOTP(false); setOtpCode(''); }}
                >
                  <ArrowLeft size={16} />
                  Back to Login
                </button>
              </form>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Main Login / Sign Up Screen ──────────────────────────────────────────
  return (
    <Layout>
      <div className="d-flex align-items-center justify-content-center px-3 py-5" style={{ minHeight: '80vh' }}>
        <div className="th-card-static p-0 anim-scale-in position-relative" style={{ maxWidth: 440, width: '100%' }}>
          
          {loadingProvider && (
            <div className="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center" style={{ background: 'rgba(255,255,255,0.9)', zIndex: 10, borderRadius: 'var(--th-radius)' }}>
              <Loader2 size={48} className="text-accent anim-spin mb-3" />
              <h5 className="font-playfair fw-bold mb-1">Verifying Identity</h5>
              <p className="text-muted small">Connecting to {loadingProvider.charAt(0).toUpperCase() + loadingProvider.slice(1)}...</p>
            </div>
          )}

          {/* Header */}
          <div className="text-center p-4 pb-2">
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 48, height: 48, background: 'var(--th-accent-light)' }}>
              <Scissors size={24} className="text-accent" />
            </div>
            <h4 className="font-playfair fw-bold">{isSignup ? 'Create Account' : 'Welcome Back'}</h4>
            <p className="text-muted small">{isSignup ? 'Join TailorHub today' : 'Sign in to your account'}</p>
          </div>

          {/* Form */}
          <div className="p-4 pt-0">
            <form onSubmit={handleSubmit}>
              {isSignup && (
                <div className="mb-3">
                  <label className="th-label" htmlFor="name">Full Name</label>
                  <input id="name" className="th-input" placeholder="Enter your name" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
              )}

              <div className="mb-3">
                <label className="th-label" htmlFor="email">Email</label>
                <input id="email" type="email" className="th-input" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="mb-1">
                <label className="th-label" htmlFor="password">Password</label>
                <input id="password" type="password" className="th-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
              </div>
              {!isSignup && (
                <div className="d-flex justify-content-end mb-4 mt-1">
                  <Link to="/forgot-password" style={{ color: 'var(--th-accent)', fontSize: '0.8rem', textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </div>
              )}
              {isSignup && (
                <p className="text-muted mb-3" style={{ fontSize: '0.7rem' }}>
                  Min 8 chars, 1 uppercase, 1 lowercase, 1 digit
                </p>
              )}
              {!isSignup && <div className="mb-4" />}

              <button type="submit" className="btn btn-accent w-100 d-flex align-items-center justify-content-center gap-2" disabled={loading}>
                {loading && <Loader2 size={16} className="anim-spin" />}
                {isSignup ? 'Sign Up' : 'Sign In'}
              </button>

              {/* Divider */}
              <div className="position-relative my-4">
                <hr />
                <span className="position-absolute top-50 start-50 translate-middle px-3 bg-white text-muted small text-uppercase">
                  Or continue with
                </span>
              </div>

              {/* Social Buttons */}
              <div className="d-flex flex-column gap-2">
                <button type="button" className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2 fw-medium" onClick={() => handleSocialLogin('google')}>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Continue with Google
                </button>
                <button type="button" className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2 fw-medium" onClick={() => handleSocialLogin('apple')}>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M16.365 14.368c-.023-2.667 2.223-3.957 2.326-4.02-1.282-1.849-3.32-2.1-4.04-2.138-1.738-.17-3.393.996-4.28.996-.884 0-2.247-.976-3.666-.948-1.85.029-3.555 1.054-4.512 2.685-1.934 3.308-.495 8.192 1.391 10.865.918 1.298 2.001 2.748 3.407 2.695 1.345-.058 1.865-.86 3.493-.86 1.629 0 2.115.86 3.518.83 1.432-.027 2.378-1.31 3.284-2.589 1.047-1.492 1.48-2.936 1.5-3.008-.035-.015-2.775-1.045-2.796-4.004zM14.964 4.545c.767-.912 1.283-2.183 1.144-3.447-1.096.046-2.457.716-3.245 1.627-.706.812-1.326 2.107-1.161 3.348 1.222.093 2.493-.615 3.262-1.528z"/></svg>
                  Continue with Apple
                </button>
                <button type="button" className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2 fw-medium" onClick={() => handleSocialLogin('facebook')}>
                  <svg width="16" height="16" fill="#1877F2" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Continue with Facebook
                </button>
              </div>

              <p className="text-center text-muted small mt-4 mb-0">
                {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button type="button" onClick={() => setIsSignup(!isSignup)} className="btn btn-link p-0 text-accent fw-medium text-decoration-none small">
                  {isSignup ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
