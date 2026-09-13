import { useMemo, useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Upload, Sparkles, Loader2, Image as ImageIcon, PersonStanding, Camera, Sun } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';
import { products, categories } from '@/data/products';
import useScrollAnim from '@/hooks/useScrollAnim';
import { Button } from '@/components/ui/button';

const tonePalette = {
  fair: ['Navy', 'Emerald', 'Charcoal', 'Maroon', 'Royal Blue'],
  medium: ['Olive', 'Mustard', 'Burgundy', 'Teal', 'Black'],
  deep: ['Ivory', 'Rust', 'Gold', 'Cobalt', 'Wine'],
};
const SKIN_PROFILE_KEY = 'tailorhub-skin-profile';

const getSkinTone = rgb => {
  const brightness = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  if (brightness > 0.72) return 'fair';
  if (brightness > 0.48) return 'medium';
  return 'deep';
};

const sampleSkinTone = imageUrl =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const centerX = Math.floor(img.width * 0.5);
      const centerY = Math.floor(img.height * 0.35);
      const size = Math.floor(Math.min(img.width, img.height) * 0.15);
      const imageData = ctx.getImageData(centerX - size, centerY - size, size * 2, size * 2).data;

      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i]; g += imageData[i + 1]; b += imageData[i + 2]; count += 1;
      }
      resolve({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) });
    };
    img.onerror = reject;
    img.src = imageUrl;
  });

const toBase64 = (blobUrl) => new Promise((resolve, reject) => {
  fetch(blobUrl)
    .then(res => res.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    })
    .catch(reject);
});

const VirtualTryOn = () => {
  const { t } = useLanguage();
  const ref = useScrollAnim();
  const [photo, setPhoto] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [tone, setTone] = useState('');
  const [avgRgb, setAvgRgb] = useState(null);
  const [skinProfile, setSkinProfile] = useState(null);

  const [garmentImage, setGarmentImage] = useState(null);
  const [garmentName, setGarmentName] = useState('');
  const [garmentDescription, setGarmentDescription] = useState('');
  const [resultImage, setResultImage] = useState(null);
  const [vtoLoading, setVtoLoading] = useState(false);
  const [garmentCategory, setGarmentCategory] = useState('all');

  const recommendedColors = useMemo(
    () => skinProfile?.recommendedColors || (tone ? tonePalette[tone] : []),
    [skinProfile, tone],
  );

  const filteredGarments = useMemo(() => {
    const stitchedProducts = products.filter(p => !p.category.startsWith('unstitched-'));
    if (garmentCategory === 'all') return stitchedProducts;
    return stitchedProducts.filter(p => p.category === garmentCategory);
  }, [garmentCategory]);

  // Auto-load the photo + skin tone results saved by the Skin Tone Analyzer
  // so the user doesn't have to upload again if they did skin tone first.
  useEffect(() => {
    const savedImage = localStorage.getItem('tailorhub-vto-image');
    const savedProfile = localStorage.getItem(SKIN_PROFILE_KEY);

    if (savedImage) setPhoto(savedImage);

    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setSkinProfile(profile);
        if (profile.tone) setTone(profile.tone);
        if (profile.rgb) setAvgRgb(profile.rgb);
      } catch (e) {
        console.warn('Could not parse saved skin profile', e);
      }
    } else if (savedImage) {
      // No saved results but we have an image — analyze it locally.
      (async () => {
        setAnalyzing(true);
        try {
          const sampled = await sampleSkinTone(savedImage);
          const detectedTone = getSkinTone(sampled);
          setAvgRgb(sampled);
          setTone(detectedTone);
        } catch (e) {
          console.error('Failed to analyze saved image', e);
          setPhoto('');
          localStorage.removeItem('tailorhub-vto-image');
        } finally {
          setAnalyzing(false);
        }
      })();
    }
  }, []);

  const onFileChange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhoto(url);
    setTone('');
    setAvgRgb(null);
    setSkinProfile(null);
    setResultImage(null);

    // Auto-analyze tone purely from the VTO upload
    setAnalyzing(true);
    try {
      localStorage.setItem('tailorhub-vto-image', url);
      const sampled = await sampleSkinTone(url);
      const detectedTone = getSkinTone(sampled);
      setAvgRgb(sampled);
      setTone(detectedTone);
      localStorage.setItem(
        SKIN_PROFILE_KEY,
        JSON.stringify({ tone: detectedTone, rgb: sampled, recommendedColors: tonePalette[detectedTone] || [] }),
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const onGarmentUpload = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setGarmentImage(url);
    setGarmentName(file.name.replace(/\.[^.]+$/, ''));
    setGarmentDescription('custom uploaded garment');
    setResultImage(null);
  };

  const handleVto = async () => {
    if (!photo || !garmentImage) return;
    setVtoLoading(true);
    setResultImage(null);
    try {
      const personB64 = await toBase64(photo);
      const garmentBlob = await fetch(garmentImage).then(r => r.blob());
      const garmentB64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(garmentBlob);
      });

      toast.info('Generating AI Try-On... This may take 15-30 seconds.');
      const response = await apiRequest('/api/vto/tryon', {
        method: 'POST',
        body: {
          person_image_base64: personB64,
          garment_image_base64: garmentB64,
          garment_description: garmentDescription || garmentName || 'A distinct mens garment'
        }
      });
      setResultImage(response.result_image_base64);
      toast.success('Try-On generated successfully!');
    } catch (e) {
      console.error(e);
      // Backend returns user-friendly messages (out of credits, rate-limited, etc.)
      toast.error(e.message || 'AI Try-On failed. Please try again.', { duration: 6000 });
    } finally {
      setVtoLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-4 py-md-5" ref={ref}>
        <div className="text-center mx-auto mb-5 scroll-anim" style={{ maxWidth: 720 }}>
          <span className="th-badge th-badge-soft mb-3 d-inline-flex align-items-center gap-1">
            <Sparkles size={12} /> {t('tryon.aiAssisted', 'AI Assisted')}
          </span>
          <h1 className="font-playfair fw-bold fs-2 fs-md-1">
            {t('tryon.titleA', '2D Virtual')} <span className="text-accent">{t('tryon.titleB', 'Try-On')}</span>
          </h1>
          <p className="text-muted mt-2 fs-6">{t('tryon.subtitle', 'Upload your photo for skin tone analysis and personalized color recommendations.')}</p>
        </div>

        <div className="mx-auto scroll-anim" style={{ maxWidth: 1100 }}>
          {/* Unified VTO & Skin Tone Section */}
          <div className="th-card-static p-4 p-md-5">
            <div className="border-bottom pb-3 mb-4">
              <h5 className="font-playfair fw-semibold mb-1">
                {t('tryon.title', 'Virtual Try-On')} <span className="text-accent">{t('vto.aiPowered', 'AI Powered')}</span>
              </h5>
              <p className="text-muted small mb-0">Upload your photo and pick a garment to preview how it looks on you.</p>
              <p className="text-muted mt-2 mb-0" style={{ fontSize: '0.72rem' }}>
                Photorealistic AI generation. Handles traditional &amp; long garments accurately (takes ~10-20s).
              </p>
            </div>

            <div className="row g-4">
              <div className="col-lg-6">
                <p className="text-muted mb-2" style={{ fontSize: '0.72rem' }}>
                  Tip: AI Try-On generates a photorealistic image and works great with traditional &amp; long garments. Use a clear, front-facing photo for best results (~10-20s).
                </p>
                {/* Category filter tabs */}
                <div className="d-flex flex-wrap gap-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setGarmentCategory('all')}
                    className={`th-filter-btn ${garmentCategory === 'all' ? 'active' : ''}`}
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  >
                    All
                  </button>
                  {categories.filter(cat => !cat.id.startsWith('unstitched-')).map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setGarmentCategory(cat.id)}
                      className={`th-filter-btn ${garmentCategory === cat.id ? 'active' : ''}`}
                      style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="row row-cols-3 g-2 mb-3" style={{ maxHeight: 340, overflowY: 'auto', padding: 4 }}>
                  <div className="col">
                    <label
                      className="rounded-2 overflow-hidden d-flex flex-column align-items-center justify-content-center text-muted"
                      style={{
                        cursor: 'pointer',
                        height: 96,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: 'var(--th-border, #ced4da)',
                        background: 'var(--th-muted, #f8f9fa)',
                      }}
                    >
                      <Upload size={18} />
                      <span style={{ fontSize: '0.62rem', marginTop: 2 }}>Upload</span>
                      <input type="file" accept="image/*" onChange={onGarmentUpload} className="d-none" />
                    </label>
                  </div>
                  {filteredGarments.map(product => (
                    <div key={product.id} className="col">
                      <div
                        onClick={() => { setGarmentImage(product.image); setGarmentName(product.name); setGarmentDescription(product.aiDescription || ''); }}
                        className="rounded-2 overflow-hidden"
                        style={{
                          cursor: 'pointer',
                          borderWidth: garmentImage === product.image ? 2 : 1,
                          borderStyle: 'solid',
                          borderColor: garmentImage === product.image ? 'var(--th-accent)' : 'transparent',
                          boxShadow: garmentImage === product.image ? 'var(--th-shadow-sm)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <img src={product.image} alt={product.name} className="w-100" style={{ height: 96, objectFit: 'contain', background: '#f5f5f5' }} />
                        <p className="text-muted text-truncate m-0 px-1" style={{ fontSize: '0.58rem', lineHeight: 1.4, padding: '2px 0' }} title={product.name}>
                          {product.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {garmentName && <p className="small fw-medium mb-3">Selected: <span className="text-accent">{garmentName}</span></p>}

                <Button
                  size="lg"
                  className="w-100"
                  onClick={handleVto}
                  disabled={!garmentImage || !photo || vtoLoading}
                >
                  {vtoLoading ? <Loader2 size={20} className="anim-spin" /> : <ImageIcon size={20} />}
                  {vtoLoading ? 'AI is generating...' : 'Generate AI Try-On'}
                </Button>
              </div>

              <div className="col-lg-6 d-flex flex-column align-items-center gap-3">
                {/* Posture Guidance Banner */}
                <div className="w-100 rounded-3 border p-3" style={{ background: 'rgba(230,126,34,0.06)', borderColor: 'rgba(230,126,34,0.15)' }}>
                  <div className="d-flex align-items-start gap-2 mb-2">
                    <Sparkles size={16} className="text-accent flex-shrink-0 mt-1" />
                    <p className="fw-semibold text-accent m-0" style={{ fontSize: '0.85rem' }}>{t('vto.proTip', 'Pro Tip for Best Results')}</p>
                  </div>
                  <div className="row g-2">
                    <div className="col-4 d-flex flex-column align-items-center text-center p-2 rounded-2" style={{ background: 'rgba(255,255,255,0.6)' }}>
                      <PersonStanding size={20} className="text-muted mb-1" />
                      <p className="m-0 fw-medium" style={{ fontSize: '0.65rem', lineHeight: 1.4 }}>{t('vto.straightPosture', 'Straight Posture')}</p>
                      <p className="m-0 text-muted" style={{ fontSize: '0.58rem', lineHeight: 1.3 }}>Stand tall, arms by side</p>
                    </div>
                    <div className="col-4 d-flex flex-column align-items-center text-center p-2 rounded-2" style={{ background: 'rgba(255,255,255,0.6)' }}>
                      <Camera size={20} className="text-muted mb-1" />
                      <p className="m-0 fw-medium" style={{ fontSize: '0.65rem', lineHeight: 1.4 }}>Front-Facing</p>
                      <p className="m-0 text-muted" style={{ fontSize: '0.58rem', lineHeight: 1.3 }}>Full body, eye level</p>
                    </div>
                    <div className="col-4 d-flex flex-column align-items-center text-center p-2 rounded-2" style={{ background: 'rgba(255,255,255,0.6)' }}>
                      <Sun size={20} className="text-muted mb-1" />
                      <p className="m-0 fw-medium" style={{ fontSize: '0.65rem', lineHeight: 1.4 }}>{t('vto.evenLighting', 'Even Lighting')}</p>
                      <p className="m-0 text-muted" style={{ fontSize: '0.58rem', lineHeight: 1.3 }}>{t('vto.avoidShadows', 'Avoid harsh shadows')}</p>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-center gap-3 w-100">
                  {/* Garment Frame */}
                  <div className="d-flex align-items-center justify-content-center rounded-3 border border-2 border-dashed overflow-hidden" style={{ aspectRatio: '3 / 4', width: '100%', maxWidth: 200, background: '#f5f5f5' }}>
                    {garmentImage ? <img src={garmentImage} className="w-100 h-100" style={{ objectFit: 'contain' }} /> : <span className="text-muted small">Garment</span>}
                  </div>
                  <span className="text-muted fs-4 flex-shrink-0">+</span>
                  {/* Photo Upload Frame */}
                  <label className="d-flex flex-column align-items-center justify-content-center rounded-3 border border-2 border-dashed overflow-hidden" style={{ aspectRatio: '3 / 4', width: '100%', maxWidth: 200, background: 'white', cursor: 'pointer', transition: 'background 0.2s' }}>
                    {photo ? (
                      <img src={photo} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                    ) : (
                      <span className="text-muted small d-flex flex-column align-items-center">
                        <Upload className="mb-2" size={24} />
                        Upload Photo
                      </span>
                    )}
                    <input type="file" accept="image/*" onChange={onFileChange} className="d-none" />
                  </label>
                </div>

                {/* Embedded Tone Results */}
                <div className="w-100">
                  {analyzing && <p className="text-muted small d-flex align-items-center gap-2"><Loader2 size={16} className="anim-spin" /> Analyzing skin tone...</p>}
                  {tone && (
                    <div className="mt-2 rounded-3 border p-3 small w-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <p className="fw-medium text-capitalize mb-0 d-flex align-items-center gap-2">
                          Detected Tone: <span className="th-badge th-badge-soft text-uppercase" style={{ letterSpacing: '0.05em' }}>{skinProfile?.label || tone}</span>
                        </p>
                        {avgRgb && (
                          <div className="d-flex align-items-center gap-2">
                            <div className="rounded-circle border shadow-sm" style={{ width: 16, height: 16, backgroundColor: `rgb(${avgRgb.r}, ${avgRgb.g}, ${avgRgb.b})` }} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="th-label mb-1" style={{ fontSize: '0.68rem' }}>{t('vto.recommendedColors', 'Recommended Fabric Colors')}</p>
                        <div className="d-flex flex-wrap gap-1">
                          {recommendedColors.map(color => <span key={color} className="th-badge th-badge-outline">{color}</span>)}
                        </div>
                        <p className="text-muted mb-0 mt-2" style={{ fontSize: '0.68rem' }}>
                          These are recommended colors — you can still select your own color.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Result Frame */}
            {(vtoLoading || resultImage) && (
              <div className="mt-5 pt-4 border-top d-flex flex-column align-items-center">
                <h5 className="font-playfair mb-4">{t('vto.aiResult', 'AI Result')}</h5>
                <div className="d-flex align-items-center justify-content-center rounded-4 overflow-hidden mx-auto"
                  style={{ aspectRatio: '3 / 4', maxWidth: 360, width: '100%', border: '4px solid rgba(230,126,34,0.2)', background: '#f1f3f5' }}>
                  {vtoLoading && !resultImage && (
                    <div className="d-flex flex-column align-items-center gap-2 text-muted text-center p-5">
                      <Loader2 size={32} className="text-accent anim-spin" />
                      <p className="mb-0">AI is processing your try-on...</p>
                      <p className="small mb-0">This usually takes 15-30 seconds.</p>
                    </div>
                  )}
                  {resultImage && <img src={resultImage} alt="VTO Result" className="w-100 h-100" style={{ objectFit: 'contain' }} />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VirtualTryOn;
