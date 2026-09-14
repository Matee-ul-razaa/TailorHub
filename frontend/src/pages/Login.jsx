import React from "react";
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Scissors, User, Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

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
  const { t, language } = useLanguage();
  const isUrdu = language === 'ur';
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
      toast.error(t('login.socialLoginFailed'));
    } else if (error) {
      toast.error(`${t('login.authError')}: ${error}`);
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
    const origin = window.location.origin;
    window.location.href = `${API_BASE_URL}/api/auth/${provider}/login?origin=${encodeURIComponent(origin)}`;
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
        toast.success(t('login.accountCreatedVerify'));
      } else {
        toast.success(t('login.accountCreated'));
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
        toast.success(t('login.welcomeBackToast'));
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
      toast.success(t('login.emailVerifiedToast'));
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
          toast.info(t('login.pleaseSignIn'));
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
      toast.success(data?.message || t('login.newCodeSent'));
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
                <h5 className="font-playfair fw-bold mb-1">{t('login.emailVerified')}</h5>
                <p className="text-muted small">{t('login.redirecting')}</p>
              </div>
            )}

            {/* Header */}
            <div className="text-center p-4 pb-2">
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 48, height: 48, background: 'var(--th-accent-light)' }}>
                <Mail size={24} className="text-accent" />
              </div>
              <h4 className="font-playfair fw-bold">{t('login.verifyEmail')}</h4>
              <p className="text-muted small">
                {t('login.weSentCode')} <strong>{otpEmail}</strong>
              </p>
            </div>

            {/* OTP Form */}
            <div className="p-4 pt-0">
              <form onSubmit={handleVerifyOTP}>
                <div className="mb-4">
                  <label className="th-label" htmlFor="otp-code">{t('login.verificationCode')}</label>
                  <input
                    id="otp-code"
                    type="text"
                    className="th-input text-center fw-bold"
                    placeholder={t('login.enter6DigitCode')}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    style={{ fontSize: '1.4rem', letterSpacing: '0.3em' }}
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-100"
                  disabled={loading || otpCode.length !== 6}
                >
                  {loading && <Loader2 size={16} className="anim-spin" />}
                  {t('login.verifyEmailBtn')}
                </Button>

                <div className="text-center mt-3">
                  <p className="text-muted small mb-2">{t('login.didntReceiveCode')}</p>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 text-amber-600"
                    onClick={handleResendOTP}
                    disabled={resending}
                  >
                    {resending ? t('login.sending') : t('login.resendCode')}
                  </Button>
                </div>

                <hr className="my-3" />
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-100"
                  onClick={() => { setShowOTP(false); setOtpCode(''); }}
                >
                  <ArrowLeft size={16} />
                  {t('login.backToLogin')}
                </Button>
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
              <h5 className="font-playfair fw-bold mb-1">{t('login.verifyingIdentity')}</h5>
              <p className="text-muted small">{t('login.connectingTo')} {loadingProvider.charAt(0).toUpperCase() + loadingProvider.slice(1)}...</p>
            </div>
          )}

          {/* Header */}
          <div className="text-center p-4 pb-2">
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 48, height: 48, background: 'var(--th-accent-light)' }}>
              <Scissors size={24} className="text-accent" />
            </div>
            <h4 className="font-playfair fw-bold">{isSignup ? t('login.createAccount') : t('login.welcomeBack')}</h4>
            <p className="text-muted small">{isSignup ? t('login.joinToday') : t('login.signInToAccount')}</p>
          </div>

          {/* Form */}
          <div className="p-4 pt-0">
            <form onSubmit={handleSubmit}>
              {isSignup && (
                <div className="mb-3 anim-slide-down">
                  <label className="th-label" htmlFor="name">{t('login.fullName')}</label>
                  <input id="name" className="th-input" placeholder={t('login.enterName')} value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
              )}

              <div className="mb-3">
                <label className="th-label" htmlFor="email">{t('login.email')}</label>
                <input id="email" type="email" className="th-input" placeholder={t('login.yourEmail')} value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="mb-1">
                <label className="th-label" htmlFor="password">{t('login.password')}</label>
                <input id="password" type="password" className="th-input" placeholder={t('login.passwordDots')} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
              </div>
              {!isSignup && (
                <div className="d-flex justify-content-end mb-4 mt-1">
                  <Link to="/forgot-password" style={{ color: 'var(--th-accent)', fontSize: '0.8rem', textDecoration: 'none' }}>
                    {t('login.forgotPassword')}
                  </Link>
                </div>
              )}
              {isSignup && (
                <p className="text-muted mb-3" style={{ fontSize: '0.7rem' }}>
                  {t('login.passwordHint')}
                </p>
              )}
              {!isSignup && <div className="mb-4" />}

              <Button type="submit" className="w-100" disabled={loading}>
                {loading && <Loader2 size={16} className="anim-spin" />}
                {isSignup ? t('login.signUp') : t('login.signIn')}
              </Button>

              {/* Divider */}
              <div className="position-relative my-4">
                <hr />
                <span className="position-absolute top-50 start-50 translate-middle px-3 bg-white text-muted small text-uppercase">
                  {t('login.orContinueWith')}
                </span>
              </div>

              {/* Social Buttons */}
              <div className="d-flex flex-column gap-2">
                <Button variant="outline" className="w-full" onClick={() => handleSocialLogin('google')}>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  {t('login.continueWithGoogle')}
                </Button>
              </div>

              <p className="text-center text-muted small mt-4 mb-0">
                {isSignup ? t('login.alreadyHaveAccount') : t('login.dontHaveAccount')}{' '}
                <Button variant="link" onClick={() => setIsSignup(!isSignup)} className="p-0 text-amber-600">
                  {isSignup ? t('login.signIn') : t('login.signUp')}
                </Button>
              </p>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
