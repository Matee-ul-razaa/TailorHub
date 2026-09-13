import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Upload, Camera, Palette, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import useScrollAnim from '@/hooks/useScrollAnim';
import { Button } from '@/components/ui/button';

const SKIN_PROFILE_KEY = 'tailorhub-skin-profile';

const TONE_DATA = {
  fair: { label: 'Fair', hex: '#F5D5C8', colors: ['Pastels', 'Navy', 'Burgundy', 'Olive'], hexColors: ['#E8D5E0', '#1B2A4A', '#800020', '#556B2F'] },
  light: { label: 'Light', hex: '#E8C4A0', colors: ['Earth Tones', 'Teal', 'Charcoal', 'Forest Green'], hexColors: ['#D2B48C', '#008080', '#36454F', '#228B22'] },
  medium: { label: 'Medium', hex: '#C8A07A', colors: ['Royal Blue', 'Gold', 'Maroon', 'Cream'], hexColors: ['#002366', '#FFD700', '#800000', '#FFFDD0'] },
  olive: { label: 'Olive', hex: '#B08D5B', colors: ['Rust', 'Mustard', 'Deep Purple', 'Ivory'], hexColors: ['#B7410E', '#FFDB58', '#301934', '#FFFFF0'] },
  brown: { label: 'Brown', hex: '#8D6E4A', colors: ['Bright Blue', 'White', 'Orange', 'Yellow'], hexColors: ['#0066FF', '#FFFFFF', '#FF6600', '#FFD700'] },
  dark: { label: 'Dark', hex: '#5C3D2E', colors: ['Emerald', 'Silver', 'Hot Pink', 'Bright White'], hexColors: ['#50C878', '#C0C0C0', '#FF69B4', '#F8F8FF'] },
};

const SkinToneAnalysis = () => {
  const { t, language } = useLanguage();
  const isUrdu = language === 'ur';
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const ref = useScrollAnim();

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    setResult(null);

    // Save image to localStorage so VirtualTryOn can pick it up automatically
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem('tailorhub-vto-image', reader.result);
      } catch (e) {
        console.warn('Image too large to save in localStorage');
      }
    };
    reader.readAsDataURL(file);
  };

  const analyzeTone = async () => {
    if (!photo) { toast.error('Please upload a photo first'); return; }
    setAnalyzing(true);

    // Simulate AI skin tone analysis
    await new Promise(r => setTimeout(r, 2000));

    // Deterministic from file size (simulated)
    const tones = Object.keys(TONE_DATA);
    const idx = photo.size % tones.length;
    const detected = tones[idx];
    const data = TONE_DATA[detected];

    setResult({ tone: detected, ...data });

    // Save to localStorage
    localStorage.setItem(SKIN_PROFILE_KEY, JSON.stringify({ tone: detected, label: data.label, hex: data.hex, recommendedColors: data.colors, hexColors: data.hexColors }));
    toast.success('Skin tone analyzed successfully!');
    setAnalyzing(false);
  };

  return (
    <Layout>
      <div className={`container py-4 py-md-5 ${isUrdu ? 'text-end' : ''}`} ref={ref} dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="text-center mb-5 scroll-anim">
          <span className="th-badge th-badge-soft mb-3 d-inline-flex align-items-center gap-1">
            <Sparkles size={12} /> {t('tryon.aiAssisted')}
          </span>
          <h1 className="font-playfair fw-bold fs-2">
            {t('skintone.title').split(' ')[0]} <span className="text-accent">{t('skintone.title').split(' ').slice(1).join(' ')}</span>
          </h1>
          <p className="text-muted mx-auto mt-2" style={{ maxWidth: 480 }}>
            {t('skintone.subtitle')}
          </p>
        </div>

        <div className="mx-auto" style={{ maxWidth: 900 }}>
          <div className="row g-4">
            {/* Upload Section */}
            <div className="col-md-6 scroll-anim">
              <div className="th-card-static p-4 h-100">
                <h5 className={`d-flex align-items-center gap-2 font-playfair fw-semibold mb-3 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                  <Camera size={20} className="text-accent" /> {t('skintone.upload')}
                </h5>
                <div className="d-flex flex-column gap-3">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="d-flex flex-column align-items-center justify-content-center rounded-3 p-5"
                    style={{
                      border: '2px dashed var(--th-border)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      minHeight: 280
                    }}
                  >
                    {photoUrl ? (
                      <img src={photoUrl} alt="Uploaded" className="rounded-3 shadow-lg" style={{ width: 256, height: 256, objectFit: 'cover' }} />
                    ) : (
                      <>
                        <Upload size={40} className="text-muted mb-3" style={{ opacity: 0.35 }} />
                        <p className="text-muted small mb-1">{t('tryon.choosePhoto')}</p>
                        <p className="text-muted" style={{ fontSize: '0.72rem', opacity: 0.6 }}>JPG, PNG — clear face photo works best</p>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={handleUpload} />

                  <Button
                    className="w-100"
                    onClick={analyzeTone}
                    disabled={!photo || analyzing}
                  >
                    {analyzing ? <Loader2 size={16} className="anim-spin" /> : <Palette size={16} />}
                    {analyzing ? t('tryon.analyzing') : t('skintone.analyze')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="col-md-6 scroll-anim-right">
              <div className="th-card-static p-4 h-100">
                <h5 className={`d-flex align-items-center gap-2 font-playfair fw-semibold mb-3 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                  <Palette size={20} className="text-accent" /> {t('skintone.result')}
                </h5>
                {result ? (
                  <div className="d-flex flex-column gap-4">
                    {/* Detected tone */}
                    <div className={`d-flex align-items-center gap-3 rounded-3 p-3 ${isUrdu ? 'flex-row-reverse' : ''}`} style={{ background: '#f1f3f5' }}>
                      <div className="rounded-circle border border-4 border-white shadow" style={{ width: 64, height: 64, backgroundColor: result.hex, flexShrink: 0 }} />
                      <div className={`flex-grow-1 ${isUrdu ? 'text-end' : ''}`}>
                        <p className="text-muted text-uppercase small mb-0" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>{t('skintone.result')}</p>
                        <p className="fw-bold fs-5 mb-0">{result.label}</p>
                        <p className="text-muted small mb-0">{result.hex}</p>
                      </div>
                      <CheckCircle2 size={24} style={{ color: '#22c55e' }} />
                    </div>

                    {/* Recommended Colors */}
                    <div>
                      <h6 className={`th-label mb-2 ${isUrdu ? 'text-end' : ''}`}>{t('skintone.recommendations')}</h6>
                      <div className="row g-2">
                        {result.colors.map((color, i) => (
                          <div key={color} className="col-6">
                            <div className={`d-flex align-items-center gap-3 rounded-3 border p-3 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                              <div className="rounded-circle shadow-sm" style={{ width: 32, height: 32, backgroundColor: result.hexColors[i], flexShrink: 0 }} />
                              <span className="small fw-medium">{color}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className={`text-muted mt-2 mb-0 ${isUrdu ? 'text-end' : ''}`} style={{ fontSize: '0.78rem' }}>
                        {t('skintone.recommendNote', 'These are recommended colors — you can still select your own color.')}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="row g-2 pt-2">
                      <div className="col-6">
                        <Link to="/catalog">
                          <Button variant="outline" size="sm" className="w-100">
                            {t('tryon.catalog')} <ArrowRight size={14} className={isUrdu ? 'rotate-180' : ''} />
                          </Button>
                        </Link>
                      </div>
                      <div className="col-6">
                        <Link to="/virtual-try-on">
                          <Button size="sm" className="w-100">
                            {t('nav.tryOn')} <ArrowRight size={14} className={isUrdu ? 'rotate-180' : ''} />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-5 text-center">
                    <Palette size={48} className="text-muted mx-auto mb-3" style={{ opacity: 0.25 }} />
                    <p className="text-muted">{t('tryon.uploadToSeeRecommendations')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SkinToneAnalysis;
