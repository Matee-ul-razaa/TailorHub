import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { Ruler, Plus, Trash2, Edit3, Copy, PlayCircle, Save, X, CalendarDays, Loader2, CheckCircle2, Clock, AlertCircle, CalendarCheck } from 'lucide-react';
import useScrollAnim from '@/hooks/useScrollAnim';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';

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
    tutorial: 'https://www.youtube.com/embed/_8CsQNTHN5w',
    fields: [
      { key: 'coatLength', label: 'Coat Length', unit: 'in' },
      { key: 'chest', label: 'Chest', unit: 'in' },
      { key: 'waist', label: 'Waist', unit: 'in' },
      { key: 'hip', label: 'Hip', unit: 'in' },
      { key: 'shoulder', label: 'Shoulder', unit: 'in' },
      { key: 'sleeveLength', label: 'Sleeve Length', unit: 'in' },
      { key: 'neck', label: 'Neck', unit: 'in' },
      { key: 'pantLength', label: 'Pant Length', unit: 'in' },
    ],
  },
  'shalwar-kameez': {
    label: 'Shalwar Kameez',
    tutorial: 'https://www.youtube.com/embed/ufQTfjiLtK4',
    fields: [
      { key: 'kameezLength', label: 'Kameez / Kurta Length', unit: 'in' },
      { key: 'chest', label: 'Chest', unit: 'in' },
      { key: 'shoulder', label: 'Shoulder', unit: 'in' },
      { key: 'sleeveLength', label: 'Sleeve Length', unit: 'in' },
      { key: 'shalwarLength', label: 'Shalwar / Pajama Length', unit: 'in' },
      { key: 'waist', label: 'Waist', unit: 'in' },
      { key: 'hip', label: 'Hip', unit: 'in' },
    ],
  },
  'waistcoat': {
    label: 'Waistcoat',
    tutorial: 'https://www.youtube.com/embed/u5xUA-gn17k',
    fields: [
      { key: 'chest', label: 'Chest', unit: 'in' },
      { key: 'waist', label: 'Waist', unit: 'in' },
      { key: 'shoulder', label: 'Shoulder', unit: 'in' },
      { key: 'jacketLength', label: 'Waistcoat Length', unit: 'in' },
      { key: 'neck', label: 'Neck', unit: 'in' },
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
  const [appointmentForm, setAppointmentForm] = useState({
    date: '',
    timeSlot: '10:00 AM - 11:00 AM',
    phone: '',
    notes: '',
  });
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchMyAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const data = await apiRequest('/api/appointments/my');
      if (Array.isArray(data)) {
        setMyAppointments(data);
      }
    } catch (err) {
      console.error('Error loading appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMyAppointments();
  }, [fetchMyAppointments]);

  const handleSubmitAppointment = async () => {
    if (!appointmentForm.phone.trim()) {
      toast.error(t('measurements.appointment.phoneRequired', 'Please enter your phone number'));
      return;
    }
    if (!appointmentForm.date) {
      toast.error(t('measurements.appointment.dateRequired', 'Please select preferred date'));
      return;
    }
    setIsSubmittingAppointment(true);
    try {
      await apiRequest('/api/appointments', {
        method: 'POST',
        body: {
          phone: appointmentForm.phone,
          appointment_date: appointmentForm.date,
          time_slot: appointmentForm.timeSlot,
          notes: appointmentForm.notes,
        },
      });
      toast.success(t('measurements.appointment.submitted', 'Appointment request submitted! Admin will review and approve soon.'));
      setShowBooking(false);
      setAppointmentForm({ date: '', timeSlot: '10:00 AM - 11:00 AM', phone: '', notes: '' });
      fetchMyAppointments();
    } catch (err) {
      toast.error(err.message || 'Failed to submit appointment');
    } finally {
      setIsSubmittingAppointment(false);
    }
  };

  const fetchMeasurements = useCallback(async () => {
    let localData = [];
    try {
      localData = JSON.parse(localStorage.getItem('tailorhub-measurements') || localStorage.getItem('tailorhub-mock-measurements') || '[]');
      if (Array.isArray(localData) && localData.length > 0) {
        setMeasurements(localData);
      }
    } catch (_) {}

    try {
      const data = await apiRequest('/api/measurements');
      if (Array.isArray(data)) {
        setMeasurements(data);
        localStorage.setItem('tailorhub-measurements', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Using cached measurements:', err);
    } finally {
      setLoading(false);
    }
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
    const url = editingId ? `/api/measurements/${editingId}` : '/api/measurements';
    const method = editingId ? 'PUT' : 'POST';
    const body = editingId
      ? { label: formLabel || undefined, data: formData }
      : { garmentType, label: formLabel || undefined, data: formData };

    try {
      const saved = await apiRequest(url, { method, body });
      toast.success(editingId ? t('measurements.success.updated') : t('measurements.success.saved'));
      setShowForm(false);
      
      const local = JSON.parse(localStorage.getItem('tailorhub-measurements') || '[]');
      const updated = editingId
        ? local.map(m => String(m.id) === String(editingId) ? saved : m)
        : [saved, ...local.filter(m => String(m.id) !== String(saved.id))];
      localStorage.setItem('tailorhub-measurements', JSON.stringify(updated));
      fetchMeasurements();
    } catch (err) { 
      const local = JSON.parse(localStorage.getItem('tailorhub-measurements') || localStorage.getItem('tailorhub-mock-measurements') || '[]');
      if (editingId) {
        const idx = local.findIndex(m => String(m.id) === String(editingId));
        if (idx !== -1) local[idx] = { ...local[idx], ...body, updatedAt: new Date().toISOString() };
      } else {
        local.unshift({
          id: `m-${Date.now()}`,
          uniqueCode: `TH-M-${Math.floor(1000 + Math.random() * 9000)}`,
          garmentType,
          label: formLabel || `${garment.label} Measurements`,
          data: formData,
          updatedAt: new Date().toISOString()
        });
      }
      localStorage.setItem('tailorhub-measurements', JSON.stringify(local));
      setMeasurements(local);
      toast.success(editingId ? t('measurements.success.updated') : t('measurements.success.saved'));
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiRequest(`/api/measurements/${id}`, { method: 'DELETE' });
    } catch (_) {}
    let local = JSON.parse(localStorage.getItem('tailorhub-measurements') || localStorage.getItem('tailorhub-mock-measurements') || '[]');
    local = local.filter(m => String(m.id) !== String(id));
    localStorage.setItem('tailorhub-measurements', JSON.stringify(local));
    setMeasurements(local);
    toast.success(t('measurements.success.deleted'));
  };

  const handleLookup = async () => {
    if (!lookupCode.trim()) return;
    try {
      const m = await apiRequest(`/api/measurements/lookup/${lookupCode.trim()}`);
      if (m) {
        toast.success(`Found: ${m.garmentType} — ${m.uniqueCode}`);
        startEdit(m);
        return;
      }
    } catch (_) {}
    
    const local = JSON.parse(localStorage.getItem('tailorhub-measurements') || localStorage.getItem('tailorhub-mock-measurements') || '[]');
    const m = local.find(x => x.uniqueCode === lookupCode.trim());
    if (m) {
      toast.success(`Found: ${m.garmentType} — ${m.uniqueCode}`);
      startEdit(m);
    } else {
      toast.error(t('measurements.error.notFound'));
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

        {/* My Measurement Appointments Section */}
        <div className="th-card-static p-4 mb-4 scroll-anim">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div className="d-flex align-items-center gap-2">
              <CalendarCheck className="text-accent" size={22} />
              <h5 className="font-playfair fw-semibold mb-0">
                {t('measurements.appointment.myTitle', 'My Measurement Appointments')}
              </h5>
              {myAppointments.length > 0 && (
                <span className="badge bg-secondary text-white rounded-pill px-2 py-0.5" style={{ fontSize: '0.75rem' }}>
                  {myAppointments.length}
                </span>
              )}
            </div>
            <Button size="sm" onClick={() => setShowBooking(true)}>
              <Plus size={14} className="me-1" />
              {t('measurements.appointment.bookNew', 'Book New Appointment')}
            </Button>
          </div>

          {loadingAppointments ? (
            <div className="text-center py-4">
              <Loader2 size={24} className="animate-spin text-accent mb-2" />
              <p className="text-muted small mb-0">Loading appointments...</p>
            </div>
          ) : myAppointments.length === 0 ? (
            <div className="text-center py-4 px-3 border rounded-3 bg-light bg-opacity-50 text-muted">
              <CalendarDays size={32} className="mb-2 opacity-50 text-accent" />
              <p className="small mb-3">
                {t('measurements.appointment.empty', 'No appointment booked yet. Can’t take measurements yourself? Book a session with our Master Tailor.')}
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowBooking(true)}>
                <CalendarDays size={14} className="me-1" />
                {t('measurements.book', 'Book Appointment')}
              </Button>
            </div>
          ) : (
            <div className="row g-3">
              {myAppointments.map(appt => {
                const statusMeta = {
                  pending: {
                    badgeClass: 'bg-warning text-dark',
                    border: 'border-warning',
                    icon: <Clock size={14} className="me-1" />,
                    label: isUrdu ? 'زیر التواء منظوری' : 'Pending Admin Approval',
                    desc: isUrdu ? 'ایڈمن کی تصدیق کا انتظار ہے۔ منظوری کے بعد آپ کو مطلع کیا جائے گا۔' : 'Waiting for Admin Approval. You will receive an in-app notification once confirmed.',
                  },
                  approved: {
                    badgeClass: 'bg-success text-white',
                    border: 'border-success',
                    icon: <CheckCircle2 size={14} className="me-1" />,
                    label: isUrdu ? 'منظور شدہ اور تصدیق شدہ' : 'Approved & Confirmed',
                    desc: isUrdu ? '✓ ماسٹر ٹیلر نے وقت کنفرم کر دیا ہے! براہ کرم مقررہ وقت پر تیار رہیں۔' : '✓ Master Tailor confirmed your slot! Please be available at the scheduled time.',
                  },
                  rejected: {
                    badgeClass: 'bg-danger text-white',
                    border: 'border-danger',
                    icon: <AlertCircle size={14} className="me-1" />,
                    label: isUrdu ? 'درخواست مسترد' : 'Declined',
                    desc: isUrdu ? 'معذرت، یہ وقت دستیاب نہیں تھا۔ براہ کرم دوسرا وقت منتخب کریں۔' : 'This time slot was unavailable. Please select another date or time slot.',
                  },
                  completed: {
                    badgeClass: 'bg-primary text-white',
                    border: 'border-primary',
                    icon: <CheckCircle2 size={14} className="me-1" />,
                    label: isUrdu ? 'مکمل' : 'Completed',
                    desc: isUrdu ? 'پیمائش کا سیشن مکمل ہو چکا ہے۔' : 'Measurement session completed.',
                  },
                };
                const meta = statusMeta[appt.status] || statusMeta.pending;

                return (
                  <div key={appt.id} className="col-md-6">
                    <div className={`p-3 rounded-3 border h-100 d-flex flex-column justify-content-between bg-white shadow-sm ${meta.border} border-opacity-25`}>
                      <div>
                        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                          <span className="fw-semibold fs-6 text-dark d-flex align-items-center gap-1">
                            <CalendarDays size={16} className="text-accent" />
                            {appt.appointment_date}
                          </span>
                          <span className={`badge rounded-pill ${meta.badgeClass} d-inline-flex align-items-center px-2 py-1`} style={{ fontSize: '0.75rem' }}>
                            {meta.icon}
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-muted small mb-2 d-flex align-items-center gap-2">
                          <Clock size={13} />
                          <span className="fw-medium">{appt.time_slot}</span>
                          <span>•</span>
                          <span>{appt.phone}</span>
                        </div>
                        {appt.notes && (
                          <div className="small text-muted fst-italic mb-2 bg-light p-2 rounded">
                            "{appt.notes}"
                          </div>
                        )}
                      </div>
                      <div className={`mt-2 p-2 rounded small ${appt.status === 'approved' ? 'bg-success bg-opacity-10 text-success' : appt.status === 'pending' ? 'bg-warning bg-opacity-10 text-dark' : 'bg-light text-muted'}`}>
                        {meta.desc}
                        {appt.admin_notes && (
                          <div className="mt-1 fw-medium">
                            Note: {appt.admin_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Booking Modal */}
        {showBooking && (
          <div className="th-modal-overlay">
            <div className="th-card-static p-0 anim-scale-in" style={{ maxWidth: 440, width: '100%', backgroundColor: 'var(--th-card-bg)' }} dir={isUrdu ? 'rtl' : 'ltr'}>
              <div className="p-4 pb-2 d-flex align-items-center justify-content-between">
                <h5 className="font-playfair fw-semibold mb-0">{t('measurements.appointment.title')}</h5>
                <Button variant="ghost" size="sm" className="p-0" onClick={() => setShowBooking(false)}><X size={20} /></Button>
              </div>
              <div className="p-4 pt-2 d-flex flex-column gap-3">
                <div>
                  <label className="th-label">{t('measurements.appointment.date')}</label>
                  <input
                    className="th-input"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={appointmentForm.date}
                    onChange={e => setAppointmentForm(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="th-label">{t('measurements.appointment.time')}</label>
                  <select
                    className="th-select"
                    value={appointmentForm.timeSlot}
                    onChange={e => setAppointmentForm(prev => ({ ...prev, timeSlot: e.target.value }))}
                  >
                    <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                    <option value="11:00 AM - 12:00 PM">11:00 AM - 12:00 PM</option>
                    <option value="2:00 PM - 3:00 PM">2:00 PM - 3:00 PM</option>
                    <option value="3:00 PM - 4:00 PM">3:00 PM - 4:00 PM</option>
                    <option value="5:00 PM - 6:00 PM">5:00 PM - 6:00 PM</option>
                  </select>
                </div>
                <div>
                  <label className="th-label">{t('measurements.appointment.phone')}</label>
                  <input
                    className="th-input"
                    type="tel"
                    placeholder="+92 300 1234567"
                    value={appointmentForm.phone}
                    onChange={e => setAppointmentForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="th-label">{t('measurements.appointment.notes')}</label>
                  <input
                    className="th-input"
                    placeholder="e.g. Need measurements for Sherwani / Prince Coat..."
                    value={appointmentForm.notes}
                    onChange={e => setAppointmentForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <Button className="w-100" onClick={handleSubmitAppointment} disabled={isSubmittingAppointment}>
                  {isSubmittingAppointment ? (
                    <>
                      <Loader2 size={16} className="animate-spin me-2" />
                      Submitting...
                    </>
                  ) : (
                    t('measurements.appointment.submit')
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tutorial Modal */}
        {tutorialUrl && (
          <div className="th-modal-overlay">
            <div className="th-card-static p-4 anim-scale-in" style={{ maxWidth: 640, width: '100%', backgroundColor: 'var(--th-card-bg)' }}>
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
                  <div className="d-flex align-items-center gap-3">
                    {garment.tutorial && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTutorialUrl(garment.tutorial)}
                        className="p-0 text-amber-600 d-flex align-items-center gap-1 hover-lift"
                      >
                        <PlayCircle size={16} /> <span className="small fw-medium">{t('measurements.howTo', 'How to Measure')}</span>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="p-0" onClick={() => setShowForm(false)}><X size={20} /></Button>
                  </div>
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
                          <div className={`d-flex align-items-center justify-content-between mb-1 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                            <label className="th-label small mb-0">{field.label} ({field.unit})</label>
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
