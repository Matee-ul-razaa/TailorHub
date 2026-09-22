import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/context/CartContext';

import { ShoppingBag, Check, ArrowLeft, Plus, Minus, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import useScrollAnim from '@/hooks/useScrollAnim';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
const SKIN_PROFILE_KEY = 'tailorhub-skin-profile';

const purchaseModeLabels = {
  'unstitched': { label: 'Unstitched Fabric', desc: 'Buy premium fabric by the meter' },
  'ready-to-wear': { label: 'Ready to Wear', desc: 'Standard sized, ready to ship' },
  'custom-stitching': { label: 'Custom Stitching', desc: 'Tailored to your measurements' },
};

const suitOptionLabels = {
  '3-piece': '3-Piece (Blazer + Vest + Pants)',
  '2-piece': '2-Piece (Blazer + Pants)',
  'blazer-only': 'Blazer / Coat Only',
  'pants-only': 'Pants Only',
  'vest-only': 'Vest / Waistcoat Only',
  'kameez-shalwar': 'Complete (Kameez + Shalwar)',
  'kameez-only': 'Kameez / Kurta Only',
  'shalwar-only': 'Shalwar / Pajama Only',
};

const measurementTemplates = {
  'shalwar-kameez': {
    titleEn: 'Shalwar Kameez Measurements',
    titleUr: 'شلوار قمیض کی پیمائش',
    fields: [
      { key: 'kameezLength', en: 'Kameez / Kurta Length', ur: 'قمیض / کرتا لمبائی' },
      { key: 'chest', en: 'Chest', ur: 'چھاتی' },
      { key: 'shoulder', en: 'Shoulder', ur: 'کندھا' },
      { key: 'sleeve', en: 'Sleeve', ur: 'بازو' },
      { key: 'neck', en: 'Neck', ur: 'گلا' },
      { key: 'bottomLength', en: 'Shalwar / Pajama Length', ur: 'شلوار / پاجامہ لمبائی' },
      { key: 'waist', en: 'Waist', ur: 'کمر' },
      { key: 'hip', en: 'Hip', ur: 'کولہا' },
    ],
  },
  'pent-coat': {
    titleEn: 'Pent Coat Measurements',
    titleUr: 'پینٹ کوٹ کی پیمائش',
    fields: [
      { key: 'coatLength', en: 'Coat Length', ur: 'کوٹ لمبائی' },
      { key: 'chest', en: 'Chest', ur: 'چھاتی' },
      { key: 'waist', en: 'Waist', ur: 'کمر' },
      { key: 'hip', en: 'Hip', ur: 'کولہا' },
      { key: 'shoulder', en: 'Shoulder', ur: 'کندھا' },
      { key: 'sleeve', en: 'Sleeve', ur: 'بازو' },
      { key: 'neck', en: 'Neck', ur: 'گلا' },
      { key: 'pantLength', en: 'Pant Length', ur: 'پینٹ لمبائی' },
      { key: 'inseam', en: 'Inseam', ur: 'اندرونی لمبائی' },
      { key: 'vestLength', en: 'Vest Length', ur: 'ویسٹ لمبائی' },
    ],
  },
  default: {
    titleEn: 'Suit / Coat Measurements',
    titleUr: 'سوٹ / کوٹ کی پیمائش',
    fields: [
      { key: 'chest', en: 'Chest', ur: 'چھاتی' },
      { key: 'waist', en: 'Waist', ur: 'کمر' },
      { key: 'shoulder', en: 'Shoulder', ur: 'کندھا' },
      { key: 'sleeve', en: 'Sleeve', ur: 'بازو' },
      { key: 'pantLength', en: 'Pant Length', ur: 'پینٹ لمبائی' },
      { key: 'inseam', en: 'Inseam', ur: 'اندرونی لمبائی' },
    ],
  },
};

const getCategoryTutorial = (category) => {
  if (category === 'pent-coat' || category === 'unstitched-pent-coat') {
    return {
      title: 'Pent Coat Measurement Guide',
      embedUrl: 'https://www.youtube.com/embed/_8CsQNTHN5w',
      watchUrl: 'https://youtube.com/shorts/_8CsQNTHN5w?si=bkSWp-rJLfHL9fBU',
    };
  }
  // Default / shalwar kameez
  return {
    title: 'Shalwar Kameez Measurement Guide',
    embedUrl: 'https://www.youtube.com/embed/ufQTfjiLtK4',
    watchUrl: 'https://youtu.be/ufQTfjiLtK4?si=zoxHr67Grk2G63WH',
  };
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { products } = useStore();
  const { language, t } = useLanguage();
  const product = products?.find(p => p.id === id);
  const ref = useScrollAnim();
  const categoryTutorial = getCategoryTutorial(product?.category);

  const [mode, setMode] = useState('ready-to-wear');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [addWaistcoat, setAddWaistcoat] = useState(false);
  const [suitOption, setSuitOption] = useState('');
  const [qty, setQty] = useState(1);
  const [selectedSwatch, setSelectedSwatch] = useState(0);
  const [measurements, setMeasurements] = useState({});
  const [isZoomed, setIsZoomed] = useState(false);
  const [bgPosition, setBgPosition] = useState('50% 50%');

  // Sync state when product loads (fixes refresh issue)
  useEffect(() => {
    if (product) {
      if (product.availableModes && product.availableModes.length > 0 && !product.availableModes.includes(mode)) {
        setMode(product.availableModes[0]);
      }
      if (product.suitOptions && product.suitOptions.length > 0 && !suitOption) {
        setSuitOption(product.suitOptions[0]);
      }
      if (product.colors && product.colors.length > 0 && !color) {
        setColor(product.colors[0]);
      }
    }
  }, [product]);

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setBgPosition(`${x}% ${y}%`);
  };
  const [skinProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SKIN_PROFILE_KEY) || 'null');
    } catch (_err) {
      return null;
    }
  });

  const [savedProfiles, setSavedProfiles] = useState([]);

  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem('tailorhub-measurements') || localStorage.getItem('tailorhub-mock-measurements') || '[]');
      if (Array.isArray(local) && local.length > 0) setSavedProfiles(local);
    } catch (_) {}

    apiRequest('/api/measurements')
      .then(res => {
        if (Array.isArray(res) && res.length > 0) {
          setSavedProfiles(res);
          localStorage.setItem('tailorhub-measurements', JSON.stringify(res));
        }
      })
      .catch(() => {});
  }, []);

  const isUnstitched = mode === 'unstitched';
  const isCustomStitching = mode === 'custom-stitching';
  const measurementTemplate =
    measurementTemplates[product?.category] || measurementTemplates.default;

  // Filter fields based on suitOption (top-only or bottom-only or vest-only)
  const activeFields = measurementTemplate.fields.filter(field => {
    if (['blazer-only', 'kameez-only', 'vest-only'].includes(suitOption)) {
      if (['pantLength', 'inseam', 'bottomLength', 'shalwarLength'].includes(field.key)) return false;
    }
    if (['pants-only', 'shalwar-only'].includes(suitOption)) {
      if (['coatLength', 'kameezLength', 'chest', 'shoulder', 'sleeve', 'neck', 'vestLength'].includes(field.key)) return false;
    }
    if (suitOption === 'vest-only') {
      if (['coatLength', 'sleeve', 'hip', 'kameezLength'].includes(field.key)) return false;
    } else if (suitOption !== '3-piece') {
      if (field.key === 'vestLength') return false;
    }
    return true;
  });

  const hasMeasurementData = activeFields.every(field => Number(measurements[field.key] || 0) > 0);
  const translateWear = (wearType) => t(`catalog.${wearType}`, wearType);

  // Get the image for the selected color or unstitched fabric
  const selectedColorImage = isUnstitched 
    ? (product?.unstitchedColorImages?.find(ci => ci.color === color)?.image || product?.unstitchedImage)
    : (product?.colorImages?.find(ci => ci.color === color)?.image || product?.image);

  if (!product) {
    return (
      <Layout>
        <div className="container d-flex align-items-center justify-content-center px-3" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <h1 className="font-playfair fw-bold fs-3">{language === 'ur' ? 'مصنوعہ دستیاب نہیں' : 'Product Not Found'}</h1>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/catalog')}>
              {language === 'ur' ? 'کیٹلاگ پر واپس' : 'Back to Catalog'}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const handleAddToCart = () => {
    if (!isCustomStitching && !isUnstitched && !size) { toast.error(language === 'ur' ? 'براہِ کرم سائز منتخب کریں' : 'Please select a size'); return; }
    if (!skinProfile?.tone) {
      toast.info(language === 'ur' ? 'بہتر رنگ تجاویز کے لیے ورچوئل ٹرائی آن میں اسکن ٹون اینالائز کریں' : 'Tip: analyze skin tone in Virtual Try-On for better color suggestions.');
    }
    if (!color) { toast.error(language === 'ur' ? 'براہِ کرم رنگ منتخب کریں' : 'Please select a color'); return; }
    if (isCustomStitching && !hasMeasurementData) {
      toast.error(language === 'ur' ? 'براہِ کرم تمام پیمائش درج کریں' : 'Please fill all measurements for custom stitching orders');
      return;
    }
    const finalSize = isCustomStitching ? (language === 'ur' ? 'کسٹم فٹ' : 'Custom Fit') : size;
    for (let i = 0; i < qty; i++) {
      addToCart(product, {
        purchaseMode: mode,
        size: finalSize,
        color,
        addWaistcoat,
        suitOption,
        measurementType: language === 'ur' ? measurementTemplate.titleUr : measurementTemplate.titleEn,
        measurements: isCustomStitching ? measurements : undefined,
      });
    }
    toast.success(language === 'ur' ? `${product.name} کارٹ میں شامل ہوگیا` : `${product.name} added to cart!`);
  };

  const getPrice = () => {
    let price = product.price;
    if (addWaistcoat) price += 3000;
    if (suitOption === '2-piece') price *= 0.75;
    if (suitOption === 'blazer-only') price *= 0.6;
    if (suitOption === 'pants-only') price *= 0.4;
    if (suitOption === 'vest-only') price *= 0.3;
    if (suitOption === 'kameez-only') price *= 0.6;
    if (suitOption === 'shalwar-only') price *= 0.4;
    if (mode === 'unstitched') price *= 0.6;
    return price;
  };

  return (
    <Layout>
      <div className="container py-4 py-md-5" ref={ref}>
        <Button variant="ghost" className="text-muted d-flex align-items-center gap-1 small mb-4 p-0" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> {t('product.back', 'Back')}
        </Button>

        <div className="row g-4 g-lg-5">
          {/* Image */}
          <div className="col-lg-6 scroll-anim-left">
            <div
              className="position-relative rounded-4 overflow-hidden"
              style={{ aspectRatio: '3 / 4', cursor: isZoomed ? 'zoom-out' : 'zoom-in' }}
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={handleMouseMove}
              onClick={() => setIsZoomed(!isZoomed)}
            >
              <img
                src={selectedColorImage}
                alt={product.name}
                className="w-100 h-100"
                style={{
                  objectFit: 'cover',
                  transform: isZoomed ? 'scale(2)' : 'scale(1)',
                  transformOrigin: bgPosition,
                  transition: 'transform 0.3s ease'
                }}
                onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }}
              />
              {!isZoomed && (
                <div className="position-absolute bottom-0 end-0 p-3 text-muted" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                  <div className="bg-white rounded-pill px-3 py-1 shadow-sm small fw-medium">{t('product.hoverZoom', 'Hover to zoom')}</div>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="col-lg-6 scroll-anim-right">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="th-badge th-badge-accent">{translateWear(product.wearType)}</span>
              <span className="th-badge th-badge-outline">{product.fabric}</span>
            </div>
            <h1 className="font-playfair fw-bold fs-2 mb-2">{product.name}</h1>
            <p className="text-muted mb-3">{product.description}</p>
            <div className="font-playfair fw-bold fs-2 text-accent mb-4">Rs. {getPrice().toLocaleString()}</div>

            {/* Purchase Mode */}
            <div className="mb-4">
              <h6 className="th-label">{t('product.purchaseMode', 'Purchase Mode')}</h6>
              <div className="row g-2">
                {product.availableModes.map(m => (
                  <div key={m} className="col-sm-4">
                    <button
                      onClick={() => setMode(m)}
                      className={`th-select-btn w-100 text-start ${mode === m ? 'selected' : ''}`}
                    >
                      <div className="fw-medium small">{purchaseModeLabels[m].label}</div>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>{purchaseModeLabels[m].desc}</div>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Suit Options (western suits) */}
            {product.suitOptions && (
              <div className="mb-4">
                <h6 className="th-label">{t('product.suitConfig', 'Suit Configuration')}</h6>
                <div className="row g-2">
                  {product.suitOptions.map(opt => (
                    <div key={opt} className="col-sm-6">
                      <button
                        onClick={() => setSuitOption(opt)}
                        className={`th-select-btn w-100 text-start small ${suitOption === opt ? 'selected' : ''}`}
                      >
                        {suitOptionLabels[opt]}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Waistcoat Option (traditional) */}
            {product.hasWaistcoatOption && (
              <div className="th-card-static p-3 mb-4">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <div className="fw-medium">{t('product.addWaistcoat', 'Add Waistcoat')}</div>
                    <div className="text-muted small">Matching embroidered waistcoat (+Rs. 3,000)</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddWaistcoat(!addWaistcoat)}
                    className="d-flex align-items-center justify-content-center rounded-2 border flex-shrink-0"
                    style={{
                      width: 32, height: 32, cursor: 'pointer',
                      background: addWaistcoat ? 'var(--th-accent)' : 'white',
                      borderColor: addWaistcoat ? 'var(--th-accent)' : 'var(--th-border)',
                      color: addWaistcoat ? 'white' : 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {addWaistcoat && <Check size={16} />}
                  </button>
                </div>

                {/* Waistcoat measurement video tutorial — ONLY shown when user clicks / selects waistcoat */}
                {addWaistcoat && (
                  <div className="mt-3 pt-3 border-top">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="fw-medium small mb-0 text-accent">
                        {language === 'ur' ? 'واسکٹ کی پیمائش کا طریقہ کار' : 'Waistcoat Measurement Guide'}
                      </h6>
                      <a
                        href="https://youtu.be/u5xUA-gn17k?si=7cRTvq3C0LaehGK0"
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent small text-decoration-none fw-medium"
                      >
                        Watch on YouTube ↗
                      </a>
                    </div>
                    <div className="rounded-3 overflow-hidden border shadow-sm" style={{ aspectRatio: '16/9', background: '#000', maxWidth: 440 }}>
                      <iframe
                        src="https://www.youtube.com/embed/u5xUA-gn17k"
                        title="Waistcoat Measurement Guide"
                        className="w-100 h-100"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Color */}
            <div className="mb-4">
              {skinProfile?.recommendedColors?.length > 0 && (
                <div className="d-flex flex-wrap gap-1 mb-2">
                  {skinProfile.recommendedColors.map(c =>
                    <span key={c} className="th-badge th-badge-outline" style={{ fontSize: '0.68rem' }}>
                      {t('product.recommendedColor', 'Recommended')}: {c}
                    </span>
                  )}
                </div>
              )}
              <h6 className="th-label">{t('product.color', 'Color')}</h6>
              <div className="d-flex flex-wrap gap-2">
                {product.colors.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`th-pill-btn ${color === c ? 'selected' : ''}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            {!isUnstitched && (
              <div className="mb-4">
                <h6 className="th-label">{t('product.size', 'Size')}</h6>
                <div className="d-flex flex-wrap gap-2">
                  {product.sizes.map(s => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className="d-flex align-items-center justify-content-center rounded-2 border"
                      style={{
                        width: 48, height: 40, cursor: 'pointer', fontSize: '0.85rem',
                        fontWeight: size === s ? 600 : 400,
                        background: size === s ? 'var(--th-accent-light)' : 'white',
                        borderColor: size === s ? 'var(--th-accent)' : 'var(--th-border)',
                        color: size === s ? 'var(--th-accent)' : 'var(--th-muted)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Stitching Measurements */}
            {isCustomStitching && (
              <div className="th-card-static p-4 mb-4">
                <div className="mb-4">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
                    <h6 className="fw-medium mb-0">{language === 'ur' ? measurementTemplate.titleUr : measurementTemplate.titleEn}</h6>
                  </div>
                  <p className="text-muted small mb-3">{t('product.measurementsSubtitle', 'Required for custom stitching orders')}</p>

                  {/* Quick Load Saved Measurements */}
                  {savedProfiles.length > 0 && (
                    <div className="p-3 mb-3 rounded-3 border d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ background: 'var(--th-accent-light, #fdf8f4)', borderColor: 'var(--th-accent)' }}>
                      <div className="d-flex align-items-center gap-2">
                        <Ruler size={16} className="text-accent flex-shrink-0" />
                        <span className="small fw-semibold">
                          {language === 'ur' ? 'محفوظ شدہ ناپ منتخب کریں:' : 'Use Saved Measurements:'}
                        </span>
                      </div>
                      <select
                        className="th-select"
                        style={{ maxWidth: 240, fontSize: '0.82rem', padding: '4px 8px' }}
                        onChange={e => {
                          const selected = savedProfiles.find(p => String(p.id) === e.target.value);
                          if (selected && selected.data) {
                            setMeasurements(prev => ({ ...prev, ...selected.data }));
                            toast.success(language === 'ur' ? 'محفوظ شدہ ناپ درج ہو گیا!' : `Applied: ${selected.label || selected.garmentType}`);
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>{language === 'ur' ? 'ناپ پروفائل منتخب کریں...' : 'Select saved profile...'}</option>
                        {savedProfiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.label || p.garmentType} ({p.uniqueCode || 'Saved'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="row g-3">
                    {activeFields.map(field => (
                      <div key={field.key} className="col-sm-6 col-md-4">
                        <label className="th-label" style={{ fontSize: '0.72rem' }}>
                          {language === 'ur' ? field.ur : field.en} (inches)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          className="th-input"
                          value={measurements[field.key] || ''}
                          onChange={e =>
                            setMeasurements(prev => ({
                              ...prev,
                              [field.key]: Number(e.target.value),
                            }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h6 className="fw-medium small mb-2">{t('product.measurementTutorial', 'Measurement Tutorial')}</h6>
                  <div style={{ maxWidth: 440 }}>
                    <div className="rounded-3 overflow-hidden border shadow-sm" style={{ aspectRatio: '16/9', background: '#000' }}>
                      <iframe
                        src={categoryTutorial.embedUrl}
                        title={categoryTutorial.title}
                        className="w-100 h-100"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="d-flex align-items-center justify-content-between mt-2">
                      <p className="text-muted mb-0 small fw-medium">{categoryTutorial.title}</p>
                      <a
                        href={categoryTutorial.watchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent small text-decoration-none fw-medium"
                      >
                        Watch on YouTube ↗
                      </a>
                    </div>
                  </div>

                  {addWaistcoat && (
                    <div className="mt-3 pt-3 border-top" style={{ maxWidth: 440 }}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <h6 className="fw-medium small mb-0 text-accent">
                          {language === 'ur' ? 'واسکٹ کی پیمائش کا طریقہ کار' : 'Waistcoat Measurement Guide'}
                        </h6>
                        <a
                          href="https://youtu.be/u5xUA-gn17k?si=7cRTvq3C0LaehGK0"
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent small text-decoration-none fw-medium"
                        >
                          Watch on YouTube ↗
                        </a>
                      </div>
                      <div className="rounded-3 overflow-hidden border shadow-sm" style={{ aspectRatio: '16/9', background: '#000' }}>
                        <iframe
                          src="https://www.youtube.com/embed/u5xUA-gn17k"
                          title="Waistcoat Measurement Guide"
                          className="w-100 h-100"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quantity + Add to Cart */}
            <div className="d-flex align-items-center gap-3">
              <div className="th-qty-control">
                <button className="th-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={product.isSoldOut}>
                  <Minus size={14} />
                </button>
                <span className="th-qty-value">{qty}</span>
                <button className="th-qty-btn" onClick={() => setQty(q => q + 1)} disabled={product.isSoldOut}>
                  <Plus size={14} />
                </button>
              </div>
              <Button size="lg" className="flex-grow-1 d-flex align-items-center justify-content-center gap-2" onClick={handleAddToCart} disabled={product.isSoldOut}>
                <ShoppingBag size={18} /> {product.isSoldOut ? 'Out of Stock' : t('product.addToCart', 'Add to Cart')}
              </Button>
            </div>
            {product.isSoldOut && (
              <div className="alert alert-danger mt-3 d-flex align-items-center gap-2" role="alert">
                <strong>SOLD OUT:</strong> This product is currently out of stock.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProductDetail;
