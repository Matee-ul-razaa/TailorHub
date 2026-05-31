import React from "react";
function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/context/CartContext';

import { ShoppingBag, Check, ArrowLeft, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import useScrollAnim from '@/hooks/useScrollAnim';
const SKIN_PROFILE_KEY = 'tailorhub-skin-profile';

const purchaseModeLabels = {
  'unstitched': { label: 'Unstitched Fabric', desc: 'Buy premium fabric by the meter' },
  'ready-to-wear': { label: 'Ready to Wear', desc: 'Standard sized, ready to ship' },
  'custom-stitching': { label: 'Custom Stitching', desc: 'Tailored to your measurements' },
};

const suitOptionLabels = {
  '3-piece': '3-Piece (Blazer + Vest + Pants)',
  '2-piece': '2-Piece (Blazer + Pants)',
  'blazer-only': 'Blazer Only',
  'pants-only': 'Pants Only',
};

const measurementTemplates = {
  'shalwar-kameez': {
    titleEn: 'Shalwar Kameez Measurements',
    titleUr: 'شلوار قمیض کی پیمائش',
    fields: [
      { key: 'kameezLength', en: 'Kameez Length', ur: 'قمیض لمبائی' },
      { key: 'chest', en: 'Chest', ur: 'چھاتی' },
      { key: 'shoulder', en: 'Shoulder', ur: 'کندھا' },
      { key: 'sleeve', en: 'Sleeve', ur: 'بازو' },
      { key: 'neck', en: 'Neck', ur: 'گلا' },
      { key: 'shalwarLength', en: 'Shalwar Length', ur: 'شلوار لمبائی' },
      { key: 'waist', en: 'Waist', ur: 'کمر' },
      { key: 'hip', en: 'Hip', ur: 'کولہا' },
    ],
  },
  'kurta-pajama': {
    titleEn: 'Kurta Pajama Measurements',
    titleUr: 'کرتا پاجامہ کی پیمائش',
    fields: [
      { key: 'kurtaLength', en: 'Kurta Length', ur: 'کرتا لمبائی' },
      { key: 'chest', en: 'Chest', ur: 'چھاتی' },
      { key: 'shoulder', en: 'Shoulder', ur: 'کندھا' },
      { key: 'sleeve', en: 'Sleeve', ur: 'بازو' },
      { key: 'neck', en: 'Neck', ur: 'گلا' },
      { key: 'pajamaLength', en: 'Pajama Length', ur: 'پاجامہ لمبائی' },
      { key: 'waist', en: 'Waist', ur: 'کمر' },
    ],
  },
  pants: {
    titleEn: 'Pant Measurements',
    titleUr: 'پینٹ کی پیمائش',
    fields: [
      { key: 'waist', en: 'Waist', ur: 'کمر' },
      { key: 'hip', en: 'Hip', ur: 'کولہا' },
      { key: 'thigh', en: 'Thigh', ur: 'ران' },
      { key: 'knee', en: 'Knee', ur: 'گھٹنا' },
      { key: 'inseam', en: 'Inseam', ur: 'اندرونی لمبائی' },
      { key: 'outseam', en: 'Outseam', ur: 'بیرونی لمبائی' },
      { key: 'bottom', en: 'Bottom Opening', ur: 'پائنچہ چوڑائی' },
    ],
  },
  shirts: {
    titleEn: 'Shirt Measurements',
    titleUr: 'شرٹ کی پیمائش',
    fields: [
      { key: 'shirtLength', en: 'Shirt Length', ur: 'شرٹ لمبائی' },
      { key: 'chest', en: 'Chest', ur: 'چھاتی' },
      { key: 'waist', en: 'Waist', ur: 'کمر' },
      { key: 'shoulder', en: 'Shoulder', ur: 'کندھا' },
      { key: 'sleeve', en: 'Sleeve', ur: 'بازو' },
      { key: 'neck', en: 'Neck', ur: 'گلا' },
    ],
  },
  default: {
    titleEn: 'Suit / Coat Measurements',
    titleUr: 'سوٹ / کوٹ کی پیمائش',
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
    ],
  },
};

const tutorialVideos = [
  { title: 'How to Measure a Shirt Correctly', url: 'https://www.youtube.com/embed/C4zY6rzA4iA' },
  { title: 'Pant & Waist Measurement Guide', url: 'https://www.youtube.com/embed/q-Rv4f3xvJQ' },
];

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { products } = useStore();
  const { language, t } = useLanguage();
  const product = products.find(p => p.id === id);
  const ref = useScrollAnim();

  const [mode, setMode] = useState(_optionalChain([product, 'optionalAccess', _ => _.availableModes, 'access', _2 => _2[0]]) || 'ready-to-wear');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [addWaistcoat, setAddWaistcoat] = useState(false);
  const [suitOption, setSuitOption] = useState(_optionalChain([product, 'optionalAccess', _3 => _3.suitOptions, 'optionalAccess', _4 => _4[0]]));
  const [qty, setQty] = useState(1);
  const [selectedSwatch, setSelectedSwatch] = useState(0);
  const [measurements, setMeasurements] = useState({});
  const [isZoomed, setIsZoomed] = useState(false);
  const [bgPosition, setBgPosition] = useState('50% 50%');

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

  const isUnstitched = mode === 'unstitched';
  const measurementTemplate =
    measurementTemplates[product?.category] ||
    (product?.category === 'suits' || product?.category === 'coats' ? measurementTemplates.default : measurementTemplates.default);
  const hasMeasurementData = measurementTemplate.fields.every(field => Number(measurements[field.key] || 0) > 0);
  const translateWear = (wearType) =>
    wearType === 'traditional' ? t('catalog.traditional', 'Traditional') : t('catalog.western', 'Western');

  if (!product) {
    return (
      <Layout>
        <div className="container d-flex align-items-center justify-content-center px-3" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <h1 className="font-playfair fw-bold fs-3">{language === 'ur' ? 'مصنوعہ دستیاب نہیں' : 'Product Not Found'}</h1>
            <button className="btn btn-outline-secondary mt-4" onClick={() => navigate('/catalog')}>
              {language === 'ur' ? 'کیٹلاگ پر واپس' : 'Back to Catalog'}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const handleAddToCart = () => {
    if (!isUnstitched && !size) { toast.error(language === 'ur' ? 'براہِ کرم سائز منتخب کریں' : 'Please select a size'); return; }
    if (!skinProfile?.tone) {
      toast.info(language === 'ur' ? 'بہتر رنگ تجاویز کے لیے ورچوئل ٹرائی آن میں اسکن ٹون اینالائز کریں' : 'Tip: analyze skin tone in Virtual Try-On for better color suggestions.');
    }
    if (!color) { toast.error(language === 'ur' ? 'براہِ کرم رنگ منتخب کریں' : 'Please select a color'); return; }
    if (isUnstitched && !hasMeasurementData) {
      toast.error(language === 'ur' ? 'براہِ کرم تمام پیمائش درج کریں' : 'Please fill all measurements for unstitched orders');
      return;
    }
    const finalSize = isUnstitched ? (language === 'ur' ? 'کسٹم فٹ' : 'Custom Fit') : size;
    for (let i = 0; i < qty; i++) {
      addToCart(product, {
        purchaseMode: mode,
        size: finalSize,
        color,
        addWaistcoat,
        suitOption,
        measurementType: language === 'ur' ? measurementTemplate.titleUr : measurementTemplate.titleEn,
        measurements: isUnstitched ? measurements : undefined,
      });
    }
    toast.success(language === 'ur' ? `${product.name} کارٹ میں شامل ہوگیا` : `${product.name} added to cart!`);
  };

  const getPrice = () => {
    let price = product.price;
    if (addWaistcoat) price += 3000;
    if (suitOption === '2-piece') price *= 0.75;
    if (suitOption === 'blazer-only') price *= 0.5;
    if (suitOption === 'pants-only') price *= 0.3;
    if (mode === 'unstitched') price *= 0.6;
    return price;
  };

  return (
    <Layout>
      <div className="container py-4 py-md-5" ref={ref}>
        <button onClick={() => navigate(-1)} className="btn btn-link text-muted text-decoration-none d-flex align-items-center gap-1 small mb-4 p-0">
          <ArrowLeft size={16} /> {t('product.back', 'Back')}
        </button>

        <div className="row g-4 g-lg-5">
          {/* Image */}
          <div className="col-lg-6 scroll-anim">
            <div 
              className="rounded-3 overflow-hidden position-relative" 
              style={{ aspectRatio: '3/4', background: '#eee', cursor: 'crosshair' }}
              onMouseEnter={() => setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={handleMouseMove}
            >
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-100 h-100" 
                style={{ 
                  objectFit: 'cover',
                  transform: isZoomed ? 'scale(2.5)' : 'scale(1)',
                  transformOrigin: bgPosition,
                  transition: isZoomed ? 'none' : 'transform 0.3s ease-out',
                  pointerEvents: 'none'
                }} 
                loading="lazy"
                onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }} 
              />
              {!isZoomed && (
                <div className="position-absolute bottom-0 end-0 p-3 text-muted" style={{ opacity: 0.6, pointerEvents: 'none' }}>
                  <div className="bg-white rounded-pill px-3 py-1 shadow-sm small fw-medium">Hover to zoom</div>
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
                <h6 className="th-label">Suit Configuration</h6>
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
              <div className="th-card-static p-3 d-flex align-items-center justify-content-between mb-4">
                <div>
                  <div className="fw-medium">Add Waistcoat</div>
                  <div className="text-muted small">Matching embroidered waistcoat (+Rs. 3,000)</div>
                </div>
                <button
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

            {/* Unstitched Fabric Gallery + Measurements */}
            {isUnstitched && (
              <div className="th-card-static p-4 mb-4">
                <div className="mb-4">
                  <h6 className="th-label">{t('product.fabricGallery', 'Unstitched Fabric Gallery')}</h6>
                  {_optionalChain([product, 'access', _5 => _5.fabricSwatches, 'optionalAccess', _6 => _6.length]) ? (
                    <>
                      <div className="rounded-3 overflow-hidden border mb-3">
                        <img
                          src={product.fabricSwatches[selectedSwatch]}
                          alt={`${product.name} swatch ${selectedSwatch + 1}`}
                          className="w-100"
                          style={{ height: 192, objectFit: 'cover' }}
                        />
                      </div>
                      <div className="row g-2">
                        {product.fabricSwatches.map((swatch, index) => (
                          <div key={swatch} className="col-4">
                            <button
                              type="button"
                              onClick={() => setSelectedSwatch(index)}
                              className="w-100 overflow-hidden rounded-2 border p-0"
                              style={{
                                borderColor: selectedSwatch === index ? 'var(--th-accent)' : 'var(--th-border)',
                                borderWidth: selectedSwatch === index ? 2 : 1,
                                cursor: 'pointer'
                              }}
                            >
                              <img src={swatch} alt={`${product.name} thumbnail ${index + 1}`} className="w-100" style={{ height: 80, objectFit: 'cover' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-muted small">{t('product.selectFabric', 'Select Fabric Preview')}</p>
                  )}
                </div>

                <div className="mb-4">
                  <h6 className="fw-medium mb-1">{language === 'ur' ? measurementTemplate.titleUr : measurementTemplate.titleEn}</h6>
                  <p className="text-muted small mb-3">{t('product.measurementsSubtitle', 'Required for unstitched tailoring orders')}</p>
                  <div className="row g-2">
                    {measurementTemplate.fields.map(field => (
                      <div key={field.key} className="col-sm-6">
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
                  <h6 className="fw-medium small mb-2">{t('product.measurementTutorial', 'Measurement Tutorials')}</h6>
                  <div className="row g-3">
                    {tutorialVideos.map(video => (
                      <div key={video.url} className="col-md-6">
                        <div className="rounded-3 overflow-hidden border" style={{ aspectRatio: '16/9' }}>
                          <iframe
                            src={video.url}
                            title={video.title}
                            className="w-100 h-100"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <p className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>{video.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quantity + Add to Cart */}
            <div className="d-flex align-items-center gap-3">
              <div className="th-qty-control">
                <button className="th-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>
                  <Minus size={14} />
                </button>
                <span className="th-qty-value">{qty}</span>
                <button className="th-qty-btn" onClick={() => setQty(q => q + 1)}>
                  <Plus size={14} />
                </button>
              </div>
              <button className="btn btn-accent btn-lg flex-grow-1 d-flex align-items-center justify-content-center gap-2" onClick={handleAddToCart}>
                <ShoppingBag size={18} /> {t('product.addToCart', 'Add to Cart')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProductDetail;
