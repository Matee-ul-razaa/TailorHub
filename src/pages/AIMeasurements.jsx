import { useState, useRef } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import useScrollAnim from '@/hooks/useScrollAnim';
import {
  Camera,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  RotateCcw,
  Ruler,
  X,
  Info,
} from 'lucide-react';

const MEASUREMENT_LABELS = {
  shoulder: 'Shoulder Width',
  chest: 'Chest',
  waist: 'Waist',
  hip: 'Hip',
  neck: 'Neck',
  sleeveLength: 'Sleeve Length',
  shirtLength: 'Shirt Length',
  inseam: 'Inseam',
};

const CONFIDENCE_CONFIG = {
  high: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'High Confidence', icon: CheckCircle2 },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Medium Confidence', icon: AlertTriangle },
  low: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Low Confidence', icon: AlertTriangle },
};

const AIMeasurements = () => {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const isUrdu = language === 'ur';
  const navigate = useNavigate();
  const ref = useScrollAnim();

  const frontInputRef = useRef(null);
  const sideInputRef = useRef(null);

  // Photo state
  const [frontImage, setFrontImage] = useState(null);
  const [sideImage, setSideImage] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [sidePreview, setSidePreview] = useState(null);

  // Form inputs
  const [gender, setGender] = useState('male');
  const [heightCm, setHeightCm] = useState('');

  // Result state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Saving state
  const [saving, setSaving] = useState(false);

  const handleImageSelect = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error(t('aimeasure.error.invalidImage', 'Please select an image file'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('aimeasure.error.tooLarge', 'Image must be under 10 MB'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      if (type === 'front') {
        setFrontImage(base64);
        setFrontPreview(base64);
      } else {
        setSideImage(base64);
        setSidePreview(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExtract = async () => {
    if (!frontImage || !sideImage) {
      toast.error(t('aimeasure.error.bothPhotos', 'Please upload both front and side photos'));
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await apiRequest('/api/measurements/extract', {
        method: 'POST',
        body: {
          front_image_base64: frontImage,
          side_image_base64: sideImage,
          gender,
          height_cm: heightCm ? parseFloat(heightCm) : 0,
        },
      });

      setResult(data);
      toast.success(t('aimeasure.success', 'AI analysis complete! Review measurements below.'));
    } catch (err) {
      const msg = err.message || 'AI analysis failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFrontImage(null);
    setSideImage(null);
    setFrontPreview(null);
    setSidePreview(null);
    setResult(null);
    setError(null);
    if (frontInputRef.current) frontInputRef.current.value = '';
    if (sideInputRef.current) sideInputRef.current.value = '';
  };

  const handleSaveToMeasurements = async () => {
    if (!result?.measurements) return;

    setSaving(true);
    try {
      await apiRequest('/api/measurements', {
        method: 'POST',
        body: {
          garmentType: 'shirt',
          label: `AI Estimated — ${new Date().toLocaleDateString()}`,
          data: result.measurements,
        },
      });
      toast.success(t('aimeasure.saved', 'Measurements saved! Redirecting...'));
      setTimeout(() => navigate('/measurements'), 1200);
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const confCfg = result ? CONFIDENCE_CONFIG[result.confidence] || CONFIDENCE_CONFIG.medium : null;

  return (
    <Layout>
      <div className={`container py-4 py-md-5 ${isUrdu ? 'text-end' : ''}`} ref={ref} dir={isUrdu ? 'rtl' : 'ltr'}>

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="mb-5 scroll-anim">
          <div className={`d-flex align-items-center gap-3 mb-2 ${isUrdu ? 'flex-row-reverse' : ''}`}>
            <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 48, height: 48, background: 'var(--th-accent-gradient)' }}>
              <Sparkles size={24} color="white" />
            </div>
            <div>
              <h1 className="font-playfair fw-bold fs-2 mb-0">
                {t('aimeasure.title', 'AI Body Measurement')}
              </h1>
              <p className="text-muted mb-0 small">
                {t('aimeasure.subtitle', 'Upload your photos and let AI estimate your body measurements')}
              </p>
            </div>
          </div>
        </div>

        {/* ── AI Verification Banner ─────────────────────────── */}
        <div className="scroll-anim mb-4" style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 12,
          padding: '14px 20px',
        }}>
          <div className={`d-flex align-items-center gap-3 ${isUrdu ? 'flex-row-reverse' : ''}`}>
            <Info size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <p className="mb-0 small" style={{ color: '#92400e' }}>
              <strong>{t('aimeasure.banner.title', 'AI Estimated — Verify Before Saving')}</strong>
              {' '}
              {t('aimeasure.banner.desc', 'AI measurements are approximate. Always verify with a tape measure before placing an order.')}
            </p>
          </div>
        </div>

        <div className="row g-4">
          {/* ── Left Column: Upload + Options ────────────────── */}
          <div className="col-lg-7">
            {/* Photo Upload Cards */}
            <div className="row g-3 mb-4 scroll-anim">
              {/* Front Photo */}
              <div className="col-sm-6">
                <div className="th-card-static p-3 h-100">
                  <div className={`d-flex align-items-center gap-2 mb-3 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                    <Camera size={18} style={{ color: 'var(--th-accent)' }} />
                    <h6 className="fw-semibold mb-0">{t('aimeasure.frontPhoto', 'Front Photo')}</h6>
                  </div>

                  {frontPreview ? (
                    <div className="position-relative" style={{ borderRadius: 10, overflow: 'hidden' }}>
                      <img
                        src={frontPreview}
                        alt="Front view"
                        style={{
                          width: '100%',
                          height: 260,
                          objectFit: 'cover',
                          borderRadius: 10,
                        }}
                      />
                      <button
                        className="btn btn-sm position-absolute"
                        onClick={() => { setFrontImage(null); setFrontPreview(null); if (frontInputRef.current) frontInputRef.current.value = ''; }}
                        style={{
                          top: 8, right: 8,
                          background: 'rgba(0,0,0,0.6)', color: '#fff',
                          borderRadius: '50%', width: 30, height: 30,
                          padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <X size={14} />
                      </button>
                      <div className="position-absolute bottom-0 start-0 end-0 px-2 py-1"
                        style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.7rem', textAlign: 'center' }}>
                        ✓ {t('aimeasure.photoReady', 'Ready')}
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="ai-front-input"
                      className="d-flex flex-column align-items-center justify-content-center text-center"
                      style={{
                        height: 260, borderRadius: 10,
                        border: '2px dashed rgba(0,0,0,0.12)',
                        background: 'rgba(0,0,0,0.02)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--th-accent)'; e.currentTarget.style.background = 'rgba(230,126,34,0.04)'; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
                    >
                      <Upload size={36} className="text-muted mb-2" style={{ opacity: 0.4 }} />
                      <p className="text-muted small mb-1 fw-medium">{t('aimeasure.uploadFront', 'Upload front view')}</p>
                      <p className="text-muted mb-0" style={{ fontSize: '0.68rem' }}>{t('aimeasure.photoTip', 'Full body, well-lit, fitted clothes')}</p>
                    </label>
                  )}
                  <input
                    ref={frontInputRef}
                    id="ai-front-input"
                    type="file"
                    accept="image/*"
                    className="d-none"
                    onChange={(e) => handleImageSelect(e, 'front')}
                  />
                </div>
              </div>

              {/* Side Photo */}
              <div className="col-sm-6">
                <div className="th-card-static p-3 h-100">
                  <div className={`d-flex align-items-center gap-2 mb-3 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                    <Camera size={18} style={{ color: 'var(--th-accent)' }} />
                    <h6 className="fw-semibold mb-0">{t('aimeasure.sidePhoto', 'Side Photo')}</h6>
                  </div>

                  {sidePreview ? (
                    <div className="position-relative" style={{ borderRadius: 10, overflow: 'hidden' }}>
                      <img
                        src={sidePreview}
                        alt="Side view"
                        style={{
                          width: '100%',
                          height: 260,
                          objectFit: 'cover',
                          borderRadius: 10,
                        }}
                      />
                      <button
                        className="btn btn-sm position-absolute"
                        onClick={() => { setSideImage(null); setSidePreview(null); if (sideInputRef.current) sideInputRef.current.value = ''; }}
                        style={{
                          top: 8, right: 8,
                          background: 'rgba(0,0,0,0.6)', color: '#fff',
                          borderRadius: '50%', width: 30, height: 30,
                          padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <X size={14} />
                      </button>
                      <div className="position-absolute bottom-0 start-0 end-0 px-2 py-1"
                        style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.7rem', textAlign: 'center' }}>
                        ✓ {t('aimeasure.photoReady', 'Ready')}
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="ai-side-input"
                      className="d-flex flex-column align-items-center justify-content-center text-center"
                      style={{
                        height: 260, borderRadius: 10,
                        border: '2px dashed rgba(0,0,0,0.12)',
                        background: 'rgba(0,0,0,0.02)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--th-accent)'; e.currentTarget.style.background = 'rgba(230,126,34,0.04)'; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
                    >
                      <Upload size={36} className="text-muted mb-2" style={{ opacity: 0.4 }} />
                      <p className="text-muted small mb-1 fw-medium">{t('aimeasure.uploadSide', 'Upload side view')}</p>
                      <p className="text-muted mb-0" style={{ fontSize: '0.68rem' }}>{t('aimeasure.photoTip', 'Full body, well-lit, fitted clothes')}</p>
                    </label>
                  )}
                  <input
                    ref={sideInputRef}
                    id="ai-side-input"
                    type="file"
                    accept="image/*"
                    className="d-none"
                    onChange={(e) => handleImageSelect(e, 'side')}
                  />
                </div>
              </div>
            </div>

            {/* Optional Inputs */}
            <div className="th-card-static p-4 mb-4 scroll-anim">
              <h6 className="fw-semibold mb-3">{t('aimeasure.optionalInputs', 'Optional — Improve Accuracy')}</h6>
              <div className="row g-3">
                <div className="col-sm-6">
                  <label htmlFor="ai-gender-select" className="th-label small">{t('aimeasure.gender', 'Gender')}</label>
                  <select id="ai-gender-select" className="th-select mt-1" value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="male">{t('aimeasure.male', 'Male')}</option>
                    <option value="female">{t('aimeasure.female', 'Female')}</option>
                    <option value="other">{t('aimeasure.other', 'Other')}</option>
                  </select>
                </div>
                <div className="col-sm-6">
                  <label htmlFor="ai-height-input" className="th-label small">{t('aimeasure.height', 'Height (cm)')}</label>
                  <input
                    id="ai-height-input"
                    className="th-input mt-1"
                    type="number"
                    min="100"
                    max="230"
                    placeholder="e.g. 175"
                    value={heightCm}
                    onChange={e => setHeightCm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="d-flex gap-3 scroll-anim">
              <button
                className="btn btn-accent flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                onClick={handleExtract}
                disabled={loading || !frontImage || !sideImage}
                style={{ height: 48 }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="anim-spin" />
                    {t('aimeasure.analyzing', 'Analyzing photos...')}
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    {t('aimeasure.extractBtn', 'Extract Measurements with AI')}
                  </>
                )}
              </button>
              {(frontImage || sideImage || result) && (
                <button
                  className="btn btn-outline-secondary d-flex align-items-center gap-2"
                  onClick={handleReset}
                  style={{ height: 48 }}
                >
                  <RotateCcw size={16} />
                  {t('aimeasure.reset', 'Reset')}
                </button>
              )}
            </div>

            {/* Error State */}
            {error && (
              <div className="mt-4 p-3 rounded-3 anim-fade-up" style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <div className={`d-flex align-items-center gap-2 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                  <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p className="mb-0 small" style={{ color: '#b91c1c' }}>{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column: Results ────────────────────────── */}
          <div className="col-lg-5">
            {!result && !loading ? (
              /* Placeholder */
              <div className="th-card-static p-5 text-center scroll-anim" style={{ borderStyle: 'dashed', border: '2px dashed rgba(0,0,0,0.08)' }}>
                <Ruler size={56} className="text-muted mx-auto mb-3" style={{ opacity: 0.2 }} />
                <h6 className="text-muted fw-medium">{t('aimeasure.placeholder.title', 'AI Results Will Appear Here')}</h6>
                <p className="text-muted small mb-0">
                  {t('aimeasure.placeholder.desc', 'Upload front and side photos, then click "Extract Measurements" to get AI-powered body estimates.')}
                </p>
              </div>
            ) : loading ? (
              /* Loading State */
              <div className="th-card-static p-5 text-center scroll-anim">
                <div className="d-flex flex-column align-items-center gap-3">
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'var(--th-accent-gradient)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pulse 2s infinite',
                  }}>
                    <Sparkles size={28} color="white" />
                  </div>
                  <h6 className="fw-semibold">{t('aimeasure.processing', 'AI is analyzing your photos...')}</h6>
                  <p className="text-muted small mb-0">{t('aimeasure.processingDesc', 'This usually takes 10-20 seconds')}</p>
                  <div style={{
                    width: '60%', height: 4, borderRadius: 2,
                    background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: '100%', height: '100%',
                      background: 'var(--th-accent-gradient)',
                      animation: 'shimmer 1.5s ease-in-out infinite',
                      transformOrigin: 'left',
                    }} />
                  </div>
                </div>
              </div>
            ) : result ? (
              /* Results */
              <div className="d-flex flex-column gap-3">
                {/* Confidence Badge */}
                <div className="th-card-static p-3 anim-fade-up scroll-anim"
                  style={{ background: confCfg.bg, borderColor: confCfg.color + '33' }}>
                  <div className={`d-flex align-items-center gap-2 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                    {confCfg.icon && <confCfg.icon size={20} style={{ color: confCfg.color }} />}
                    <div>
                      <p className="fw-semibold mb-0 small" style={{ color: confCfg.color }}>
                        {t(`aimeasure.conf.${result.confidence}`, confCfg.label)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Measurements Grid */}
                <div className="th-card-static p-4 anim-fade-up scroll-anim" style={{ animationDelay: '0.1s' }}>
                  <div className={`d-flex align-items-center justify-content-between mb-3 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                    <h6 className="fw-semibold mb-0">
                      <Ruler size={16} className={isUrdu ? 'ms-2' : 'me-2'} style={{ color: 'var(--th-accent)' }} />
                      {t('aimeasure.results', 'Estimated Measurements')}
                    </h6>
                    <span className="th-badge th-badge-soft" style={{ fontSize: '0.68rem' }}>
                      {Object.keys(result.measurements).length} {t('aimeasure.fields', 'fields')}
                    </span>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    {Object.entries(result.measurements).map(([key, value], i) => (
                      <div
                        key={key}
                        className={`d-flex align-items-center justify-content-between rounded-3 px-3 py-2 ${isUrdu ? 'flex-row-reverse' : ''}`}
                        style={{
                          background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                          animationDelay: `${i * 0.05}s`,
                        }}
                      >
                        <span className="text-muted small text-capitalize">
                          {MEASUREMENT_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="fw-semibold" style={{ color: 'var(--th-accent)', fontSize: '1.05rem' }}>
                          {value}"
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {result.notes && result.notes.length > 0 && (
                  <div className="th-card-static p-3 anim-fade-up scroll-anim" style={{ animationDelay: '0.2s' }}>
                    <h6 className="fw-semibold mb-2 small">
                      {t('aimeasure.notes', 'AI Notes')}
                    </h6>
                    <div className="d-flex flex-column gap-1">
                      {result.notes.map((note, i) => (
                        <p key={i} className="text-muted small mb-0" style={{ fontSize: '0.78rem' }}>
                          • {note}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save Button */}
                <button
                  className="btn btn-accent w-100 d-flex align-items-center justify-content-center gap-2 anim-fade-up"
                  onClick={handleSaveToMeasurements}
                  disabled={saving}
                  style={{ height: 48, animationDelay: '0.3s' }}
                >
                  {saving ? (
                    <Loader2 size={18} className="anim-spin" />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                  {saving
                    ? t('aimeasure.saving', 'Saving...')
                    : t('aimeasure.saveBtn', 'Save & Go to Measurements')}
                </button>

                <p className="text-muted text-center small" style={{ fontSize: '0.72rem' }}>
                  {t('aimeasure.saveHint', 'Measurements will be saved to your profile. You can edit them anytime.')}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── How It Works Section ──────────────────────────── */}
        <div className="mt-5 scroll-anim">
          <h5 className="font-playfair fw-semibold mb-4">{t('aimeasure.howItWorks', 'How It Works')}</h5>
          <div className="row g-3">
            {[
              {
                icon: <Camera size={22} />,
                title: t('aimeasure.step1.title', 'Take Two Photos'),
                desc: t('aimeasure.step1.desc', 'Stand in front of a plain background. Take a front view and a side view in fitted clothes.'),
              },
              {
                icon: <Sparkles size={22} />,
                title: t('aimeasure.step2.title', 'AI Analysis'),
                desc: t('aimeasure.step2.desc', 'Our Gemini Vision AI analyzes proportions and estimates 8 key body measurements.'),
              },
              {
                icon: <Ruler size={22} />,
                title: t('aimeasure.step3.title', 'Review & Save'),
                desc: t('aimeasure.step3.desc', 'Verify the AI estimates with a tape measure, adjust if needed, then save to your profile.'),
              },
            ].map((step, i) => (
              <div key={i} className="col-md-4">
                <div className="th-card-static p-4 h-100 text-center hover-lift">
                  <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{
                      width: 48, height: 48,
                      background: 'var(--th-accent-light, rgba(230,126,34,0.1))',
                      color: 'var(--th-accent)',
                    }}>
                    {step.icon}
                  </div>
                  <h6 className="fw-semibold mb-2">{step.title}</h6>
                  <p className="text-muted small mb-0">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inline CSS for animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: scaleX(0); opacity: 0.6; }
          50% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(0); opacity: 0.6; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
      `}</style>
    </Layout>
  );
};

export default AIMeasurements;
