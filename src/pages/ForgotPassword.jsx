import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Mail, KeyRound, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP/New Pass, 3: Success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const { forgotPassword, resetPassword, resendOTP } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isUrdu = language === 'ur';

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await forgotPassword(email);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('forgot.codeSent', 'Reset code sent!'));
      setStep(2);
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('forgot.mismatch'));
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email, code, newPassword);
    if (error) {
      toast.error(error.message);
    } else {
      setStep(3);
      toast.success(t('forgot.success'));
      setTimeout(() => navigate('/login'), 2500);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    const { error } = await resendOTP(email);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('forgot.codeSent', 'New code sent!'));
    }
    setResending(false);
  };

  return (
    <Layout>
      <div className="d-flex align-items-center justify-content-center px-3 py-5" style={{ minHeight: '80vh' }} dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="th-card-static p-0 anim-scale-in overflow-hidden" style={{ maxWidth: 440, width: '100%' }}>
          
          {/* Step 1: Email */}
          {step === 1 && (
            <>
              <div className="text-center p-4 pb-2">
                <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 48, height: 48, background: 'var(--th-accent-light)' }}>
                  <Mail size={24} className="text-accent" />
                </div>
                <h4 className="font-playfair fw-bold">
                  {t('forgot.title1')} <span className="text-accent">{t('forgot.title2')}</span>
                </h4>
                <p className="text-muted small">Enter your email to receive a reset code.</p>
              </div>
              <div className="p-4 pt-0">
                <form onSubmit={handleSendCode}>
                  <div className="mb-4">
                    <label className="th-label">{t('forgot.email')}</label>
                    <input
                      type="email"
                      className="th-input"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-accent w-100 d-flex align-items-center justify-content-center gap-2" disabled={loading}>
                    {loading && <Loader2 size={16} className="anim-spin" />}
                    {t('forgot.sendCode')}
                  </button>
                  <Link to="/login" className="btn btn-link w-100 mt-3 text-muted text-decoration-none small d-flex align-items-center justify-content-center gap-2">
                    <ArrowLeft size={14} /> {t('forgot.backToLogin')}
                  </Link>
                </form>
              </div>
            </>
          )}

          {/* Step 2: OTP & New Password */}
          {step === 2 && (
            <>
              <div className="text-center p-4 pb-2">
                <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 48, height: 48, background: 'var(--th-accent-light)' }}>
                  <KeyRound size={24} className="text-accent" />
                </div>
                <h4 className="font-playfair fw-bold">{t('forgot.resetButton')}</h4>
                <p className="text-muted small">We sent a code to <strong>{email}</strong></p>
              </div>
              <div className="p-4 pt-0">
                <form onSubmit={handleResetPassword}>
                  <div className="mb-3">
                    <label className="th-label">{t('forgot.code')}</label>
                    <input
                      type="text"
                      className="th-input text-center fw-bold"
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      style={{ letterSpacing: '0.3em', fontSize: '1.2rem' }}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="th-label">{t('forgot.newPassword')}</label>
                    <input
                      type="password"
                      className="th-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={12}
                    />
                    <p className="text-muted mt-1 mb-0" style={{ fontSize: '0.65rem' }}>{t('forgot.passwordHint')}</p>
                  </div>
                  <div className="mb-4">
                    <label className="th-label">{t('forgot.confirmPassword')}</label>
                    <input
                      type="password"
                      className="th-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-accent w-100 d-flex align-items-center justify-content-center gap-2" disabled={loading}>
                    {loading && <Loader2 size={16} className="anim-spin" />}
                    {t('forgot.resetButton')}
                  </button>
                  <div className="text-center mt-3">
                    <button type="button" onClick={handleResend} disabled={resending} className="btn btn-link p-0 text-accent text-decoration-none small fw-medium">
                      {resending ? t('forgot.sending') : t('forgot.resendCode')}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center p-5">
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-4" style={{ width: 64, height: 64, background: '#f0fdf4' }}>
                <CheckCircle2 size={32} className="text-success" />
              </div>
              <h4 className="font-playfair fw-bold mb-2">{t('forgot.success')}</h4>
              <p className="text-muted mb-0">{t('forgot.redirecting')}</p>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
};

export default ForgotPassword;
