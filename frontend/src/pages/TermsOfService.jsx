import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useLanguage } from '@/context/LanguageContext';
import { FileCheck, Scissors, RefreshCw, CreditCard, Truck, AlertCircle, ArrowLeft, Mail, Phone } from 'lucide-react';

const TermsOfService = () => {
  const { language } = useLanguage();
  const isUrdu = language === 'ur';

  return (
    <Layout>
      <div className="py-5" style={{ minHeight: '80vh' }} dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="container py-4" style={{ maxWidth: 920 }}>
          {/* Breadcrumb / Back button */}
          <div className="mb-4">
            <Link
              to="/"
              className="d-inline-flex align-items-center gap-2 text-decoration-none small text-muted hover-lift"
            >
              <ArrowLeft size={16} />
              <span>{isUrdu ? 'مرکزی صفحہ پر واپس جائیں' : 'Back to Home'}</span>
            </Link>
          </div>

          {/* Header Card */}
          <div
            className="p-4 p-md-5 rounded-4 mb-5 text-center text-md-start position-relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(197, 160, 89, 0.12) 0%, rgba(30, 41, 59, 0.04) 100%)',
              border: '1px solid rgba(197, 160, 89, 0.25)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="d-inline-flex align-items-center gap-2 rounded-pill px-3 py-1 mb-3 small fw-semibold" style={{ background: 'rgba(197, 160, 89, 0.2)', color: '#9d7c36' }}>
              <FileCheck size={16} />
              <span>{isUrdu ? 'سروس کی شرائط و ضوابط' : 'Terms & Conditions'}</span>
            </div>
            <h1 className="font-playfair fw-bold mb-3" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)' }}>
              {isUrdu ? 'سروس کی شرائط' : 'Terms of Service'}
            </h1>
            <p className="text-muted mb-0" style={{ maxWidth: 650, fontSize: '1.05rem', lineHeight: 1.6 }}>
              {isUrdu
                ? 'ٹیلر ہب کے پریمیم درزی اور کسٹم سلائی سروسز استعمال کرنے کی تفصیلی شرائط و ضوابط۔'
                : 'Please review our bespoke tailoring, alteration warranties, payment terms, and delivery guidelines before placing your order.'}
            </p>
            <div className="small text-muted mt-3">
              <strong>{isUrdu ? 'آخری تجدید:' : 'Last Updated:'}</strong> {isUrdu ? 'ستمبر ۲۰۲۶' : 'September 2026'}
            </div>
          </div>

          {/* Terms Content */}
          <div className="d-flex flex-column gap-4">
            {/* Section 1: Agreement */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <FileCheck size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۱. معاہدہ کی منظوری' : '1. Acceptance of Terms'}
                </h3>
              </div>
              <p className="text-muted leading-relaxed mb-0">
                {isUrdu
                  ? 'ٹیلر ہب کی ویب سائٹ یا خدمات استعمال کرنے یا آرڈر بک کرنے پر آپ ان تمام شرائط و ضوابط کے پابند ہوں گے۔ اگر آپ ان شرائط سے متفق نہیں ہیں تو برائے مہربانی پلیٹ فارم کا استعمال نہ کریں۔'
                  : 'By accessing TailorHub, registering an account, or placing an order for custom tailoring or garments, you accept and agree to be bound by these Terms of Service in full.'}
              </p>
            </div>

            {/* Section 2: Bespoke Tailoring & Measurements */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <Scissors size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۲. کسٹم سلائی اور پیمائش کی درستگی' : '2. Bespoke Tailoring & Measurement Accuracy'}
                </h3>
              </div>
              <ul className="text-muted ps-3 mb-0" style={{ lineHeight: 1.8 }}>
                <li>
                  {isUrdu
                    ? 'کسٹمر کی فراہم کردہ پیمائشوں کی درستگی کسٹمر کی ذمہ داری ہے۔ اگر آپ چاہیں تو ہمارے ماہر ماسٹر سے ہوم وزٹ کے ذریعے پیمائش کروا سکتے ہیں۔'
                    : 'Customers are responsible for providing precise measurements. Alternatively, you may book our Master Tailor home-visit service for guaranteed accurate profiling.'}
                </li>
                <li>
                  {isUrdu
                    ? 'ہمارے کاریگر فراہم کردہ ناپ اور منتخب کٹنگ پیٹرن کے مطابق باریک بینی سے کام مکمل کرتے ہیں۔'
                    : 'Each suit, sherwani, or shalwar kameez is individually handcrafted according to the submitted cut and style preferences.'}
                </li>
              </ul>
            </div>

            {/* Section 3: Free Alterations Policy */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <RefreshCw size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۳. ۷ دن کی مفت فٹنگ الٹریشن گارنٹی' : '3. 7-Day Perfect Fit & Alteration Guarantee'}
                </h3>
              </div>
              <p className="text-muted leading-relaxed mb-0">
                {isUrdu
                  ? 'اگر ڈیلیوری کے بعد لباس کی فٹنگ میں کوئی فرق ہو، تو آپ ڈیلیوری کے ۷ دنوں کے اندر مفت الٹریشن کی درخواست کر سکتے ہیں۔ ہمارا رائیڈر آپ سے لباس واپس لے کر ماسٹر سے دوبارہ فٹ کروا کر واپس پہنچائے گا۔'
                  : 'We pride ourselves on our Perfect Fit Guarantee. If your custom garment deviates from the agreed measurements, you are entitled to free alterations within 7 calendar days of delivery.'}
              </p>
            </div>

            {/* Section 4: Payments & Khata Ledger */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <CreditCard size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۴. ادائیگیاں، ایڈوانس اور کھاتہ لیجر' : '4. Payments, Advances & Khata Ledger'}
                </h3>
              </div>
              <ul className="text-muted ps-3 mb-0" style={{ lineHeight: 1.8 }}>
                <li>
                  {isUrdu
                    ? 'کسٹم سوٹس کی کٹنگ شروع کرنے کے لیے کم از کم پچاس فیصد (50%) ایڈوانس ادائیگی لازمی ہے۔'
                    : 'A minimum 50% advance deposit (or full payment) is required before our cutting masters commence fabric cutting.'}
                </li>
                <li>
                  {isUrdu
                    ? 'بقیہ رقم ڈیلیوری کے وقت یا کوریئر کی آمد پر نقد (COD) یا آن لائن ادا کی جا سکتی ہے۔ کھاتہ رجسٹرڈ صارفین اپنی شرائط کے مطابق ادائیگی کر سکتے ہیں۔'
                    : 'The remaining balance must be settled upon physical delivery or through the secure customer portal prior to final dispatch.'}
                </li>
              </ul>
            </div>

            {/* Section 5: Delivery & Digital Signature */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <Truck size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۵. ڈیلیوری اور ڈیجیٹل دستخط' : '5. Delivery & Digital Handover Signature'}
                </h3>
              </div>
              <p className="text-muted leading-relaxed mb-0">
                {isUrdu
                  ? 'جب ہمارا رائیڈر آپ کے پتے پر لباس ڈیلیور کرے گا، تو پارسل کی وصولی کی تصدیق کے لیے ڈیجیٹل دستخط وصول کیے جاتے ہیں۔ دستخط کے بعد آرڈر مکمل تصور کیا جاتا ہے۔'
                  : 'Upon delivery, the recipient or authorized representative must sign the rider’s handheld device to confirm package receipt and condition. Once signed, the order status transitions to delivered.'}
              </p>
            </div>

            {/* Section 6: Cancellations */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <AlertCircle size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۶. آرڈر منسوخی اور ریفنڈ' : '6. Order Cancellations & Refunds'}
                </h3>
              </div>
              <p className="text-muted leading-relaxed mb-0">
                {isUrdu
                  ? 'چونکہ کسٹم ملبوسات صرف آپ کی مخصوص پیمائش کے مطابق تیار ہوتے ہیں، کپڑا کٹ جانے کے بعد آرڈر منسوخ نہیں کیا جا سکتا۔ کپڑے کی کٹنگ سے پہلے آرڈر منسوخ کرنے کی صورت میں مکمل ریفنڈ ممکن ہے۔'
                  : 'Because bespoke items are made entirely to your custom body specifications, orders cannot be cancelled once fabric has entered the cutting phase. Pre-cutting cancellations are eligible for a 100% refund.'}
              </p>
            </div>

            {/* Section 7: Contact */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <h3 className="h5 fw-bold mb-3">
                {isUrdu ? '۷. رابطہ برائے رہنمائی' : '7. Contact & Inquiries'}
              </h3>
              <p className="text-muted mb-4">
                {isUrdu
                  ? 'سروس شرائط یا کسی آرڈر سے متعلق سوالات کے لیے بلا جھجھک ہماری ٹیم سے رابطہ کریں:'
                  : 'For any questions or custom inquiries regarding these Terms of Service, please contact our support desk:'}
              </p>
              <div className="d-flex flex-wrap gap-4 text-muted small">
                <div className="d-flex align-items-center gap-2">
                  <Mail size={18} className="text-accent" />
                  <span>support@tailorhub.pk</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Phone size={18} className="text-accent" />
                  <span>+92 315 7855767</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TermsOfService;
