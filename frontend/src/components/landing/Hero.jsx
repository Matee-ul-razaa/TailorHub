import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import GradientButton from '@/components/ui/GradientButton';
import { Button } from '@/components/ui/button';

const Hero = () => {
  const { t, language } = useLanguage();
  const isUrdu = language === 'ur';

  // Slider state
  const heroImages = [
    "/catalog/garments/hero-pentcoat.jpg",
    "/catalog/garments/hero-shalwar-1.jpg",
    "/catalog/garments/hero-shalwar-2.jpg"
  ];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const stats = isUrdu
    ? [
        { value: '5,000+', label: 'خوش گاہک' },
        { value: '200+', label: 'پریمیم کپڑے' },
        { value: '15+', label: 'سال کا تجربہ' },
      ]
    : [
        { value: '5,000+', label: 'Happy Customers' },
        { value: '200+', label: 'Premium Fabrics' },
        { value: '15+', label: 'Years Experience' },
      ];

  return (
    <section className="th-hero py-5 animated-gradient-bg position-relative">
      {/* Floating Particles */}
      <div className="particles-container">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="particle"></div>
        ))}
      </div>

      <div className="container position-relative py-5" style={{ zIndex: 1 }}>
        <div className="row align-items-center">
          <div className={`col-lg-6 mb-5 mb-lg-0 ${isUrdu ? 'text-end' : 'text-start'}`} dir={isUrdu ? 'rtl' : 'ltr'}>
            {/* Badge */}
            <div className="d-inline-flex align-items-center gap-2 rounded-pill px-4 py-2 mb-4 anim-fade-down glass-card border-0">
              <Sparkles size={16} className="text-accent" />
              <span className="small fw-semibold">{t('hero.badge')}</span>
            </div>

            {/* Title */}
            <h1 
              className="font-playfair fw-bold mb-4 anim-fade-up"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 1.1 }}
            >
              {isUrdu ? (
                <>
                  <span className="th-shimmer-text">جدید</span> جینٹل مین کے لیے تیار کیا گیا
                </>
              ) : (
                <>
                  Crafted for the <span className="th-shimmer-text">Modern</span> Gentleman
                </>
              )}
            </h1>

            {/* Subtitle */}
            <p 
              className="mb-5 anim-fade-up anim-delay-2 text-muted"
              style={{ fontSize: '1.2rem', maxWidth: 540 }}
            >
              {t('hero.subtitle')}
            </p>

            {/* CTA Buttons */}
            <div className={`d-flex flex-column flex-sm-row gap-3 anim-fade-up anim-delay-3 ${isUrdu ? 'justify-content-end' : 'justify-content-start'}`}>
              <Link to="/catalog" className="text-decoration-none">
                <GradientButton className="btn-lg d-flex align-items-center justify-content-center gap-2 px-5 w-100">
                  {t('hero.explore')} <ArrowRight size={18} />
                </GradientButton>
              </Link>
              <Link to="/virtual-try-on" className="text-decoration-none">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-100"
                  style={{ borderRadius: '50px' }}
                >
                  {t('hero.tryOn')}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="row g-4 mt-5 pt-4 border-top anim-fade-up anim-delay-4" style={{ borderColor: 'rgba(128, 128, 128, 0.2) !important' }}>
              {stats.map(stat => (
                <div key={stat.label} className="col-4">
                  <div className="font-playfair fw-bold fs-3 text-accent anim-count-pulse">{stat.value}</div>
                  <div className="small mt-1 text-muted">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-lg-5 offset-lg-1 d-none d-lg-block position-relative anim-fade-left">
            <div className="position-relative hover-zoom w-100" style={{ height: '600px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', background: 'rgba(255,255,255,0.1)' }}>
               {heroImages.map((src, index) => (
                 <img
                   key={src}
                   src={src}
                   alt={`Bespoke Tailoring ${index + 1}`}
                   className="w-100 h-100 object-fit-cover position-absolute top-0 start-0"
                   style={{ 
                     objectPosition: 'top',
                     opacity: currentImageIndex === index ? 1 : 0,
                     transition: 'opacity 0.8s ease-in-out'
                   }}
                 />
               ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
