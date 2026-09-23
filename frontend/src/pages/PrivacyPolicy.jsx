import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useLanguage } from '@/context/LanguageContext';
import { ShieldCheck, Lock, Eye, FileText, ArrowLeft, Mail, Phone, Sparkles } from 'lucide-react';

const PrivacyPolicy = () => {
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
              <ShieldCheck size={16} />
              <span>{isUrdu ? 'رازداری اور ڈیٹا کا تحفظ' : 'Privacy & Data Protection'}</span>
            </div>
            <h1 className="font-playfair fw-bold mb-3" style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)' }}>
              {isUrdu ? 'پرائیویسی پالیسی' : 'Privacy Policy'}
            </h1>
            <p className="text-muted mb-0" style={{ maxWidth: 650, fontSize: '1.05rem', lineHeight: 1.6 }}>
              {isUrdu
                ? 'ٹیلر ہب پر ہم آپ کے ذاتی ڈیٹا اور جسمانی پیمائشوں کے مکمل تحفظ کے پابند ہیں۔ جانیے کہ ہم آپ کی معلومات کس طرح محفوظ رکھتے ہیں۔'
                : 'At TailorHub, we take your personal privacy, bespoke measurements, and AI try-on assets with paramount confidentiality and security.'}
            </p>
            <div className="small text-muted mt-3">
              <strong>{isUrdu ? 'آخری تجدید:' : 'Last Updated:'}</strong> {isUrdu ? 'ستمبر ۲۰۲۶' : 'September 2026'}
            </div>
          </div>

          {/* Policy Sections */}
          <div className="d-flex flex-column gap-4">
            {/* Section 1: Overview */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <FileText size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۱. معلومات جو ہم جمع کرتے ہیں' : '1. Information We Collect'}
                </h3>
              </div>
              <p className="text-muted leading-relaxed mb-3">
                {isUrdu
                  ? 'جب آپ ٹیلر ہب سروسز کا استعمال کرتے ہیں، تو ہم آرڈر کی تکمیل اور بہترین فٹنگ کے لیے درج ذیل معلومات جمع کرتے ہیں:'
                  : 'To craft high-precision bespoke garments and provide seamless digital tailoring, we collect the following details:'}
              </p>
              <ul className="text-muted ps-3 mb-0" style={{ lineHeight: 1.8 }}>
                <li>
                  <strong>{isUrdu ? 'ذاتی شناخت:' : 'Personal Details:'}</strong> {isUrdu ? 'نام، ای میل، رابطہ نمبر اور ڈیلیوری کا پتہ۔' : 'Name, email address, phone number, and physical delivery address.'}
                </li>
                <li>
                  <strong>{isUrdu ? 'کسٹم پیمائشیں:' : 'Custom Measurements:'}</strong> {isUrdu ? 'کالر، سینہ، کمر، آستین، لمبائی، اور کٹنگ کی دیگر تفصیلات جو آپ کے پروفائل میں محفوظ ہوتی ہیں۔' : 'Collar, chest, waist, sleeve, inseam, and custom fitting specifications saved in your profile.'}
                </li>
                <li>
                  <strong>{isUrdu ? 'ورچوئل ٹرائی آن اور سکن ٹون:' : 'Virtual Try-On & Skin Tone Images:'}</strong> {isUrdu ? 'وہ تصاویر جو آپ AI فیبرک موازنہ اور رنگ کے انتخاب کے لیے عارضی طور پر اپ لوڈ کرتے ہیں۔' : 'User-submitted photographs processed temporarily to recommend matching fabric colors and virtual draping.'}
                </li>
              </ul>
            </div>

            {/* Section 2: AI & Virtual Try-On Privacy */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <Sparkles size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۲. ورچوئل ٹرائی آن اور AI رازداری' : '2. Virtual Try-On & AI Privacy'}
                </h3>
              </div>
              <p className="text-muted leading-relaxed mb-3">
                {isUrdu
                  ? 'ہمارا جدید AI ورچوئل ٹرائی آن نظام صارفین کی مکمل پرائیویسی کے ساتھ ڈیزائن کیا گیا ہے:'
                  : 'Our AI Virtual Try-On and skin tone analysis tools adhere to strict privacy-first principles:'}
              </p>
              <ul className="text-muted ps-3 mb-0" style={{ lineHeight: 1.8 }}>
                <li>
                  {isUrdu
                    ? 'آپ کی اپ لوڈ کردہ تصاویر صرف ریئل ٹائم ویژولائزیشن کے لیے استعمال ہوتی ہیں اور انہیں کسی تیسرے فریق کو فروخت نہیں کیا جاتا۔'
                    : 'Uploaded photos are processed securely in memory and are never sold, rented, or distributed to advertisers.'}
                </li>
                <li>
                  {isUrdu
                    ? 'AI جنریشن کے فوراً بعد پروسیسنگ ڈیٹا کو خودکار طور پر کلین کر دیا جاتا ہے۔'
                    : 'Temporary image tokens generated during the virtual fitting session expire automatically.'}
                </li>
              </ul>
            </div>

            {/* Section 3: Payments Security */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <Lock size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۳. ادائیگی اور مالیاتی تحفظ' : '3. Payment & Financial Security'}
                </h3>
              </div>
              <p className="text-muted leading-relaxed mb-0">
                {isUrdu
                  ? 'آن لائن کارڈ ادائیگیاں عالمی معیار کے تصدیق شدہ گیٹ وے (Stripe) کے ذریعے 256-bit اینڈ ٹو اینڈ اینکرپشن کے ساتھ پروسیس کی جاتی ہیں۔ ٹیلر ہب آپ کے کریڈٹ یا ڈیبٹ کارڈ کا خفیہ ڈیٹا اپنے سرورز پر کبھی محفوظ نہیں کرتا۔'
                  : 'All credit and debit card transactions are processed through Stripe with Level 1 PCI-DSS compliant encryption. TailorHub never stores your sensitive CVV or card credentials on our servers.'}
              </p>
            </div>

            {/* Section 4: Data Control & Rights */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div className="d-inline-flex p-2 rounded-3" style={{ background: 'rgba(197, 160, 89, 0.15)', color: '#c5a059' }}>
                  <Eye size={22} />
                </div>
                <h3 className="h5 fw-bold mb-0">
                  {isUrdu ? '۴. آپ کے حقوق اور ڈیٹا کنٹرول' : '4. Your Rights & Data Control'}
                </h3>
              </div>
              <p className="text-muted leading-relaxed mb-3">
                {isUrdu
                  ? 'آپ کو اپنی پیمائشوں، محفوظ پروفائلز اور آرڈر ہسٹری پر مکمل کنٹرول حاصل ہے:'
                  : 'You maintain full ownership of your bespoke fitting profiles and account data:'}
              </p>
              <ul className="text-muted ps-3 mb-0" style={{ lineHeight: 1.8 }}>
                <li>
                  {isUrdu
                    ? 'آپ کسی بھی وقت اپنے اکاؤنٹ سے محفوظ پیمائشیں تبدیل یا حذف کر سکتے ہیں۔'
                    : 'You can update, edit, or delete stored body measurements from your Measurements dashboard at any time.'}
                </li>
                <li>
                  {isUrdu
                    ? 'اگر آپ اپنا اکاؤنٹ مکمل طور پر بند کرنا چاہیں تو ہماری سپورٹ ٹیم سے رابطہ کر سکتے ہیں۔'
                    : 'You can request full data removal or export of your transaction history by contacting our support desk.'}
                </li>
              </ul>
            </div>

            {/* Section 5: Contact */}
            <div className="p-4 p-md-5 rounded-4 bg-white shadow-sm border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <h3 className="h5 fw-bold mb-3">
                {isUrdu ? '۵. رابطہ اور سپورٹ' : '5. Contact Information'}
              </h3>
              <p className="text-muted mb-4">
                {isUrdu
                  ? 'پرائیویسی پالیسی یا ذاتی ڈیٹا سے متعلق کسی بھی سوال کے لیے ہم سے رابطہ کریں:'
                  : 'If you have any questions or feedback regarding this Privacy Policy, our customer privacy team is here to assist:'}
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

export default PrivacyPolicy;
