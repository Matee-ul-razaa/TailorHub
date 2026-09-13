import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { Ruler, Plus, Trash2, Edit3, Copy, PlayCircle, Save, X, CalendarDays, Loader2 } from 'lucide-react';
import useScrollAnim from '@/hooks/useScrollAnim';
import { Button } from '@/components/ui/button';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

// Reasonable adult measurement ranges in inches for real-time validation
const MEASUREMENT_RANGES = {
  chest: { min: 28, max: 60 },
  shoulder: { min: 14, max: 24 },
  sleeveLength: { min: 18, max: 30 },
  neck: { min: 12, max: 22 },
  shirtLength: { min: 24, max: 36 },
  kameezLength: { min: 32, max: 48 },
  shalwarLength: { min: 32, max: 46 },
  shalwarPancha: { min: 6, max: 14 },
  waist: { min: 24, max: 56 },
  hip: { min: 30, max: 60 },
  inseam: { min: 24, max: 36 },
  thigh: { min: 18, max: 32 },
  pantLength: { min: 32, max: 46 },
  bottomWidth: { min: 5, max: 12 },
  jacketLength: { min: 26, max: 36 },
  pantInseam: { min: 24, max: 36 },
  kurtaLength: { min: 34, max: 46 },
  pajamaLength: { min: 34, max: 46 },
};

// Measurement fields per garment type with YouTube tutorial links
const GARMENT_FIELDS = {
  'pent-coat': {
    label: 'Pent Coat',
    fields: [
      { key: 'coatLength', label: 'Coat Length', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'chest', label: 'Chest', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'waist', label: 'Waist', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'hip', label: 'Hip', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'shoulder', label: 'Shoulder', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'sleeveLength', label: 'Sleeve Length', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'neck', label: 'Neck', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'pantLength', label: 'Pant Length', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
    ],
  },
  'shalwar-kameez': {
    label: 'Shalwar Kameez',
    fields: [
      { key: 'kameezLength', label: 'Kameez / Kurta Length', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'chest', label: 'Chest', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'shoulder', label: 'Shoulder', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'sleeveLength', label: 'Sleeve Length', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'shalwarLength', label: 'Shalwar / Pajama Length', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'waist', label: 'Waist', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
      { key: 'hip', label: 'Hip', unit: 'in', tutorial: 'https://www.youtube.com/embed/O_gDvfG7iQM' },
    ],
  },
};

const Measurements = () => {
  const { session } = useAuth();
  const token = session?.access_token;
  const { t, language } = useLanguage();
  const isUrdu = language === 'ur';
  const ref = useScrollAnim();
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [garmentType, setGarmentType] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [tutorialUrl, setTutorialUrl] = useState(null);
  const [lookupCode, setLookupCode] = useState('');
  const [showBooking, setShowBooking] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchMeasurements = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/measurements`, { headers });
      if (res.ok) setMeasurements(await res.json());
    } catch { 
      try {
        const local = JSON.parse(localStorage.getItem('tailorhub-mock-measurements') || '[]');
        setMeasurements(local);
      } catch(e) { setMeasurements([]); }
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchMeasurements(); }, [fetchMeasurements]);

  const startNew = (type) => {
    setGarmentType(type);
    setFormLabel('');
    setFormData({});
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (m) => {
    setGarmentType(m.garmentType);
    setFormLabel(m.label || '');
    setFormData(m.data || {});
    setEditingId(m.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const garment = GARMENT_FIELDS[garmentType];
    if (!garment) return;
    const missing = garment.fields.filter(f => !formData[f.key] || formData[f.key] <= 0);
    if (missing.length > 0) {
      toast.error(`${t('measurements.error.fillAll')}: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    setSaving(true);
    const url = editingId ? `${API}/api/measurements/${editingId}` : `${API}/api/measurements`;
    const method = editingId ? 'PUT' : 'POST';
    const body = editingId
      ? { label: formLabel || undefined, data: formData }
      : { garmentType, label: formLabel || undefined, data: formData };

    try {
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success(editingId ? t('measurements.success.updated') : t('measurements.success.saved'));
        setShowForm(false);
        fetchMeasurements();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to save');
      }
    } catch { 
      const local = JSON.parse(localStorage.getItem('tailorhub-mock-measurements') || '[]');
      if (editingId) {
        const idx = local.findIndex(m => m.id === editingId);
        if (idx !== -1) local[idx] = { ...local[idx], ...body, updatedAt: new Date().toISOString() };
      } else {
        local.push({
          id: `m-${Date.now()}`,
          uniqueCode: `TH-M-${Math.floor(1000 + Math.random() * 9000)}`,
          garmentType,
          label: formLabel || undefined,
          data: formData,
          updatedAt: new Date().toISOString()
        });
      }
      localStorage.setItem('tailorhub-mock-measurements', JSON.stringify(local));
      toast.success(editingId ? t('measurements.success.updated') : t('measurements.success.saved'));
      setShowForm(false);
      fetchMeasurements();
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API}/api/measurements/${id}`, { method: 'DELETE', headers });
      toast.success(t('measurements.success.deleted'));
      fetchMeasurements();
    } catch { 
      let local = JSON.parse(localStorage.getItem('tailorhub-mock-measurements') || '[]');
      local = local.filter(m => m.id !== id);
      localStorage.setItem('tailorhub-mock-measurements', JSON.stringify(local));
      toast.success(t('measurements.success.deleted'));
      fetchMeasurements();
    }
  };

  const handleLookup = async () => {
    if (!lookupCode.trim()) return;
    try {
      const res = await fetch(`${API}/api/measurements/lookup/${lookupCode.trim()}`, { headers });
      if (res.ok) {
        const m = await res.json();
        toast.success(`Found: ${m.garmentType} — ${m.uniqueCode}`);
        startEdit(m);
      } else toast.error(t('measurements.error.notFound'));
    } catch { 
      const local = JSON.parse(localStorage.getItem('tailorhub-mock-measurements') || '[]');
      const m = local.find(x => x.uniqueCode === lookupCode.trim());
      if (m) {
        toast.success(`Found: ${m.garmentType} — ${m.uniqueCode}`);
        startEdit(m);
      } else {
        toast.error(t('measurements.error.notFound'));
      }
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`${t('measurements.success.copied')}: ${code}`);
  };

  const garment = garmentType ? GARMENT_FIELDS[garmentType] : null;

  return (
    <Layout>
      <div className={`container py-4 py-md-5 ${isUrdu ? 'text-end' : ''}`} ref={ref} dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="mb-5 scroll-anim">
          <h1 className="font-playfair fw-bold fs-2">
            <Ruler className={`${isUrdu ? 'ms-2' : 'me-2'} text-accent`} size={28} />
            {t('measurements.title')}
          </h1>
          <p className="text-muted mt-2">{t('measurements.subtitle')}</p>
        </div>

        {/* Lookup by Code */}
        <div className="th-card-static p-4 mb-4 scroll-anim">
          <div className="row g-3 align-items-end">
            <div className="col-sm">
              <label className="th-label">{t('measurements.lookup')}</label>
              <input className="th-input mt-1" placeholder="e.g. TH-M-7291" value={lookupCode} onChange={e => setLookupCode(e.target.value)} />
            </div>
            <div className="col-sm-auto">
              <Button variant="outline" className="w-100" onClick={handleLookup}>
                <Ruler size={16} /> {t('measurements.load')}
              </Button>
            </div>
            <div className="col-sm-auto">
              <Button variant="outline" className="w-100" onClick={() => setShowBooking(true)}>
                <CalendarDays size={16} /> {t('measurements.book')}
              </Button>
            </div>
          </div>
        </div>

        {/* Booking Modal */}
        {showBooking && (
          <div className="th-modal-overlay">
            <div className="th-card-static p-0 anim-scale-in" style={{ maxWidth: 440, width: '100%' }} dir={isUrdu ? 'rtl' : 'ltr'}>
              <div className="p-4 pb-2 d-flex align-items-center justify-content-between">
                <h5 className="font-playfair fw-semibold mb-0">{t('measurements.appointment.title')}</h5>
                <Button variant="ghost" size="sm" className="p-0" onClick={() => setShowBooking(false)}><X size={20} /></Button>
              </div>
              <div className="p-4 pt-2 d-flex flex-column gap-3">
                <div>
                  <label className="th-label">{t('measurements.appointment.date')}</label>
                  <input className="th-input" type="date" min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="th-label">{t('measurements.appointment.time')}</label>
                  <select className="th-select">
                    <option value="" disabled>{t('measurements.selectTime', 'Select time slot')}</option>
                    <option value="10am">10:00 AM - 11:00 AM</option>
                    <option value="11am">11:00 AM - 12:00 PM</option>
                    <option value="2pm">2:00 PM - 3:00 PM</option>
                    <option value="3pm">3:00 PM - 4:00 PM</option>
                    <option value="5pm">5:00 PM - 6:00 PM</option>
                  </select>
                </div>
                <div>
                  <label className="th-label">{t('measurements.appointment.phone')}</label>
                  <input className="th-input" type="tel" placeholder="+92 300 1234567" />
                </div>
                <div>
                  <label className="th-label">{t('measurements.appointment.notes')}</label>
                  <input className="th-input" placeholder="..." />
                </div>
                <Button className="w-100" onClick={() => { toast.success('Appointment request submitted!'); setShowBooking(false); }}>
                  {t('measurements.appointment.submit')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tutorial Modal */}
        {tutorialUrl && (
          <div className="th-modal-overlay">
            <div className="th-card-static p-4 anim-scale-in" style={{ maxWidth: 640, width: '100%' }}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="fw-semibold mb-0">{t('measurements.tutorial.title')}</h5>
                <Button variant="ghost" size="sm" className="p-0" onClick={() => setTutorialUrl(null)}><X size={20} /></Button>
              </div>
              <div className="rounded-3 overflow-hidden" style={{ aspectRatio: '16/9', background: '#eee' }}>
                <iframe src={tutorialUrl} className="w-100 h-100" allowFullScreen title="Tutorial" />
              </div>
            </div>
          </div>
        )}

        <div className="row g-4">
          {/* Left: Saved Measurements */}
          <div className="col-lg-8">
            {loading ? (
              <div className="d-flex align-items-center justify-content-center py-5">
                <Loader2 size={32} className="text-accent anim-spin" />
              </div>
            ) : measurements.length === 0 && !showForm ? (
              <div className="th-card-static p-5 text-center border-dashed scroll-anim" style={{ borderStyle: 'dashed' }}>
                <Ruler size={48} className="text-muted mx-auto mb-3" style={{ opacity: 0.3 }} />
                <p className="fs-5 text-muted">{t('measurements.noSaved')}</p>
                <p className="text-muted small mb-0">{t('measurements.selectGarment')}</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {measurements.map((m, i) => (
                  <div key={m.id} className="th-card-static p-4 hover-lift scroll-anim" style={{ transitionDelay: `${i * 0.08}s` }}>
                    <div className="d-flex align-items-start justify-content-between">
                      <div className={isUrdu ? 'text-end' : ''}>
                        <div className={`d-flex align-items-center gap-2 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                          <span className="th-badge th-badge-soft" style={{ fontFamily: 'monospace' }}>{m.uniqueCode}</span>
                          <Button variant="ghost" size="sm" className="p-0" onClick={() => copyCode(m.uniqueCode)}><Copy size={14} /></Button>
                        </div>
                        <h6 className="fw-semibold mt-1 mb-0">{m.label || m.garmentType}</h6>
                        <p className="text-muted small mb-0">{t('measurements.type')}: {GARMENT_FIELDS[m.garmentType]?.label || m.garmentType} · {t('measurements.updated')}: {new Date(m.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div className="d-flex gap-1">
                        <Button variant="ghost" size="sm" className="p-1" onClick={() => startEdit(m)}><Edit3 size={16} /></Button>
                        <Button variant="ghost" size="sm" className="p-1 text-danger" onClick={() => handleDelete(m.id)}><Trash2 size={16} /></Button>
                      </div>
                    </div>
                    <hr className="th-separator" />
                    <div className={`row g-2 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                      {Object.entries(m.data).map(([key, val]) => (
                        <div key={key} className="col-sm-4 col-6">
                          <div className={`d-flex justify-content-between rounded-2 px-2 py-1 ${isUrdu ? 'flex-row-reverse' : ''}`} style={{ background: '#f1f3f5', fontSize: '0.82rem' }}>
                            <span className="text-muted text-capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <span className="fw-medium">{val}"</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Measurement Form */}
            {showForm && garment && (
              <div className="th-card-static p-4 mt-4 anim-fade-up" style={{ borderColor: 'rgba(230,126,34,0.3)' }}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="fw-semibold mb-0">{editingId ? t('measurements.edit') : t('measurements.new')} {garment.label} {t('nav.measurements')}</h5>
                  <Button variant="ghost" size="sm" className="p-0" onClick={() => setShowForm(false)}><X size={20} /></Button>
                </div>
                <div className="d-flex flex-column gap-3">
                  <div>
                    <label className="th-label">{t('measurements.label')}</label>
                    <input className="th-input" placeholder="e.g. Eid 2026 Suit" value={formLabel} onChange={e => setFormLabel(e.target.value)} />
                  </div>
                  <div className="row g-3">
                    {garment.fields.map(field => {
                      const val = formData[field.key];
                      const range = MEASUREMENT_RANGES[field.key];
                      let warning = null;
                      if (val && range) {
                        if (val < range.min) warning = `Usually > ${range.min}"`;
                        else if (val > range.max) warning = `Usually < ${range.max}"`;
                      }
                      
                      return (
                        <div key={field.key} className="col-sm-6">
                          <div className={`d-flex align-items-center justify-content-between ${isUrdu ? 'flex-row-reverse' : ''}`}>
                            <label className="th-label small">{field.label} ({field.unit})</label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setTutorialUrl(field.tutorial)}
                              className="p-0 text-amber-600 d-flex align-items-center gap-1"
                              style={{ fontSize: '0.72rem' }}
                            >
                              <PlayCircle size={14} /> {t('measurements.howTo')}
                            </Button>
                          </div>
                          <div className="position-relative">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              className={`th-input ${warning ? 'border-warning' : ''}`}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                              value={formData[field.key] || ''}
                              onChange={e => setFormData(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) || '' }))}
                            />
                            {warning && (
                              <div className="position-absolute text-warning fw-medium small" style={{ bottom: '-18px', right: '5px', fontSize: '0.65rem' }}>
                                ! {warning}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button className="w-100" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 size={16} className="anim-spin" /> : <Save size={16} />}
                    {editingId ? t('measurements.update') : t('measurements.save')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Garment Type Selector */}
          <div className="col-lg-4">
            <div className="th-card-static p-4 position-sticky scroll-anim-right" style={{ top: 80 }}>
              <h5 className="fw-semibold mb-3">{t('measurements.addNew')}</h5>
              <div className="d-flex flex-column gap-2">
                {Object.entries(GARMENT_FIELDS).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => startNew(key)}
                    className={`th-select-btn d-flex align-items-center gap-3 w-100 text-start ${isUrdu ? 'flex-row-reverse text-end' : ''}`}
                  >
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40, background: 'var(--th-accent-light)', color: 'var(--th-accent)' }}>
                      <Plus size={20} />
                    </div>
                    <div>
                      <p className="fw-medium mb-0">{val.label}</p>
                      <p className="text-muted mb-0" style={{ fontSize: '0.72rem' }}>{val.fields.length} {t('measurements.fields.count')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Measurements;
