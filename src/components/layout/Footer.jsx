import React from "react";
import { Link } from 'react-router-dom';
import { Scissors, Mail, Phone, MapPin, Instagram, Facebook, Twitter } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const Footer = () => {
  const { language, t } = useLanguage();
  const isUrdu = language === 'ur';

  return (
    <footer className="th-footer py-5 mt-auto border-top">
      <div className="container py-4">
        <div className="row g-5">
          {/* Brand */}
          <div className="col-lg-4" dir={isUrdu ? 'rtl' : 'ltr'}>
            <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none mb-4">
              <div className="d-flex align-items-center justify-content-center rounded-circle" style={{ width: 40, height: 40, background: 'var(--th-accent-gradient)' }}>
                <Scissors size={20} color="white" />
              </div>
              <span className="font-playfair fs-4 fw-bold text-white">
                Tailor<span className="text-warning">Hub</span>
              </span>
            </Link>
            <p className="small mb-4" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 300 }}>
              {isUrdu
                ? 'پریمیم مردانہ سلائی اور فیشن۔ بہترین معیار کے ساتھ تیار کیے گئے ملبوسات۔'
                : "Premium men's tailoring and fashion. Bespoke garments crafted to perfection with precision and elegance."}
            </p>
            <div className="d-flex gap-3">
              <a href="#" className="text-white-50 hover-rotate"><Instagram size={20} /></a>
              <a href="#" className="text-white-50 hover-rotate"><Facebook size={20} /></a>
              <a href="#" className="text-white-50 hover-rotate"><Twitter size={20} /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-sm-6 col-lg-2 offset-lg-1" dir={isUrdu ? 'rtl' : 'ltr'}>
            <h6 className="font-playfair text-uppercase small fw-bold mb-4 text-white letter-spacing-1">
              {isUrdu ? 'فوری لنکس' : 'Company'}
            </h6>
            <div className="d-flex flex-column gap-3 small">
              <Link to="/" className="text-decoration-none text-white-50 hover-lift">About Us</Link>
              <Link to="/catalog" className="text-decoration-none text-white-50 hover-lift">{t('nav.catalog')}</Link>
              <Link to="/virtual-try-on" className="text-decoration-none text-white-50 hover-lift">{t('nav.tryOn')}</Link>
              <Link to="/login" className="text-decoration-none text-white-50 hover-lift">{isUrdu ? 'میرا اکاؤنٹ' : 'My Account'}</Link>
            </div>
          </div>

          {/* Categories */}
          <div className="col-sm-6 col-lg-2" dir={isUrdu ? 'rtl' : 'ltr'}>
            <h6 className="font-playfair text-uppercase small fw-bold mb-4 text-white letter-spacing-1">
              {isUrdu ? 'اقسام' : 'Categories'}
            </h6>
            <div className="d-flex flex-column gap-3 small">
              <Link to="/catalog?category=suits" className="text-decoration-none text-white-50 hover-lift">{isUrdu ? 'سوٹس' : 'Suits'}</Link>
              <Link to="/catalog?category=shirts" className="text-decoration-none text-white-50 hover-lift">{isUrdu ? 'شرٹس' : 'Shirts'}</Link>
              <Link to="/catalog?category=kurta-pajama" className="text-decoration-none text-white-50 hover-lift">{isUrdu ? 'کرتا پاجامہ' : 'Kurta Pajama'}</Link>
              <Link to="/catalog?category=shalwar-kameez" className="text-decoration-none text-white-50 hover-lift">{isUrdu ? 'شلوار قمیض' : 'Shalwar Kameez'}</Link>
            </div>
          </div>

          {/* Contact */}
          <div className="col-lg-3" dir={isUrdu ? 'rtl' : 'ltr'}>
            <h6 className="font-playfair text-uppercase small fw-bold mb-4 text-white letter-spacing-1">
              {isUrdu ? 'رابطہ' : 'Contact'}
            </h6>
            <div className="d-flex flex-column gap-3 small text-white-50">
              <div className="d-flex align-items-start gap-3">
                <MapPin size={18} className="text-warning mt-1" />
                <span>123 Tailor Street, Fashion Avenue<br />Lahore, Pakistan</span>
              </div>
              <div className="d-flex align-items-center gap-3">
                <Phone size={18} className="text-warning" />
                <span>+92 3284630780</span>
              </div>
              <div className="d-flex align-items-center gap-3">
                <Mail size={18} className="text-warning" />
                <span>info@tailorhub.com</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-top text-center d-flex flex-column flex-md-row justify-content-between align-items-center" style={{ borderColor: 'rgba(255,255,255,0.1) !important' }}>
          <div className="small text-white-50 mb-3 mb-md-0">
            © {new Date().getFullYear()} TailorHub. {isUrdu ? 'تمام حقوق محفوظ ہیں۔' : 'All rights reserved.'}
          </div>
          <div className="d-flex gap-3 small text-white-50">
            <Link to="#" className="text-decoration-none text-white-50 hover-lift">Privacy Policy</Link>
            <Link to="#" className="text-decoration-none text-white-50 hover-lift">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
