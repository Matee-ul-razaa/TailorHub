import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { KeyRound, ShieldCheck, Loader2, ArrowLeft, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { changePassword, roles } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isUrdu = language === 'ur';

  const getStrength = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  };

  const strength = getStrength(newPassword);
  const strengthLabel = ['', t('change.weak'), t('change.fair'), t('change.good'), t('change.strong')];
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];

  const isAdmin = roles.includes('admin');
  const isDelivery = roles.includes('delivery');
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleBack = () => {
    if (isAdmin) navigate('/admin');
    else if (isDelivery) navigate('/delivery');
    else navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('change.mismatch'));
      return;
    }
    if (currentPassword === newPassword) {
      toast.error(t('change.sameAsCurrent'));
      return;
    }
    setLoading(true);
    const { error } = await changePassword(currentPassword, newPassword);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('change.success'));
      handleBack();
    }
    setLoading(false);
  };

  const PasswordField = ({ label, value, onChange, show, onToggle, id, minLength }) => (
    <div className="mb-3">
      <label className="th-label" htmlFor={id}>{label}</label>
      <div className="position-relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="th-input pe-5"
          value={value}
          onChange={onChange}
          required
          minLength={minLength}
          style={{ paddingRight: '2.8rem' }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="position-absolute border-0 bg-transparent p-0 d-flex align-items-center"
          style={{ top: '50%', right: '0.9rem', transform: 'translateY(-50%)', color: 'var(--th-muted)', cursor: 'pointer', zIndex: 2 }}
          tabIndex={-1}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="container py-5" dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="th-card-static anim-scale-in p-4">

              {/* Header */}
              <div className="text-center mb-4">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                  style={{ width: 56, height: 56, background: 'var(--th-accent-light)' }}
                >
                  <KeyRound size={26} className="text-accent" />
                </div>
                <h4 className="font-playfair fw-bold mb-1">{t('change.title')}</h4>
                <p className="text-muted small mb-0">{t('change.subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit}>

                {/* Current Password */}
                <PasswordField
                  id="current-pw"
                  label={t('change.current')}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  show={showCurrent}
                  onToggle={() => setShowCurrent(p => !p)}
                />

                {/* New Password */}
                <div className="mb-1">
                  <PasswordField
                    id="new-pw"
                    label={t('change.new')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    show={showNew}
                    onToggle={() => setShowNew(p => !p)}
                    minLength={8}
                  />
                </div>

                {/* Strength Bar */}
                {newPassword.length > 0 && (
                  <div className="mb-3">
                    <div className="d-flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="flex-grow-1"
                          style={{
                            height: 5,
                            borderRadius: 3,
                            transition: 'background 0.3s',
                            background: i <= strength ? strengthColor[strength] : '#e5e7eb',
                          }}
                        />
                      ))}
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                        {t('change.minCharsHint')}
                      </span>
                      <span className="fw-semibold" style={{ fontSize: '0.7rem', color: strengthColor[strength] }}>
                        {strengthLabel[strength]}
                      </span>
                    </div>
                  </div>
                )}
                {newPassword.length === 0 && (
                  <div className="mb-3">
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {t('change.minCharsHint')}
                    </span>
                  </div>
                )}

                {/* Confirm Password */}
                <div className="mb-1">
                  <PasswordField
                    id="confirm-pw"
                    label={t('change.confirm')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    show={showConfirm}
                    onToggle={() => setShowConfirm(p => !p)}
                  />
                </div>

                {/* Match indicator */}
                {confirmPassword.length > 0 && (
                  <div className="mb-3 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                    {passwordsMatch
                      ? <><CheckCircle2 size={14} color="#22c55e" /><span style={{ color: '#22c55e' }}>{t('change.passwordsMatch')}</span></>
                      : <><XCircle size={14} color="#ef4444" /><span style={{ color: '#ef4444' }}>{t('change.passwordsMismatch')}</span></>
                    }
                  </div>
                )}
                {confirmPassword.length === 0 && <div className="mb-3" />}

                {/* Buttons */}
                <div className="d-flex gap-3 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="flex-grow-1"
                  >
                    <ArrowLeft size={15} /> {t('change.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-grow-1"
                    disabled={loading || passwordsMismatch}
                  >
                    {loading ? <Loader2 size={15} className="anim-spin" /> : <ShieldCheck size={15} />}
                    {t('change.updateButton')}
                  </Button>
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChangePassword;
