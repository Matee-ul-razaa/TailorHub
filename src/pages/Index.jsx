import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import Hero from '@/components/landing/Hero';
import WhyChooseUs from '@/components/landing/WhyChooseUs';
import HowItWorks from '@/components/landing/HowItWorks';
import FeaturedProducts from '@/components/landing/FeaturedProducts';
import Testimonials from '@/components/landing/Testimonials';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import GlassCard from '@/components/ui/GlassCard';
import GradientButton from '@/components/ui/GradientButton';
import { Palette, ShoppingBag, Ruler, Sparkles, ArrowRight, X } from 'lucide-react';

const SKIN_PROFILE_KEY = 'tailorhub-skin-profile';
const ONBOARDING_KEY = 'tailorhub-onboarding-shown';

const Index = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isUrdu = language === 'ur';
  const navigate = useNavigate();
  const [showSkinPrompt, setShowSkinPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    try {
      const profile = JSON.parse(localStorage.getItem(SKIN_PROFILE_KEY) || 'null');
      setShowSkinPrompt(!profile?.tone);
    } catch {
      setShowSkinPrompt(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const seen = localStorage.getItem(ONBOARDING_KEY);
      if (!seen) setShowOnboarding(true);
    }
  }, [user]);

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  };

  const handleChoice = (path) => {
    dismissOnboarding();
    navigate(path);
  };

  const onboardingChoices = [
    { path: '/skin-tone', icon: Palette, iconBg: '#8b5cf6', title: t('onboarding.skintone.title'), desc: t('onboarding.skintone.desc') },
    { path: '/catalog', icon: ShoppingBag, iconBg: '#3b82f6', title: t('onboarding.catalog.title'), desc: t('onboarding.catalog.desc') },
    { path: '/measurements', icon: Ruler, iconBg: '#10b981', title: t('onboarding.measurements.title'), desc: t('onboarding.measurements.desc') },
  ];

  return (
    <Layout>
      {/* Post-Signup Choice Screen */}
      {showOnboarding && (
        <div className="th-modal-overlay">
          <GlassCard className="p-4 p-md-5 anim-scale-in" style={{ maxWidth: 520, width: '100%' }} dir={isUrdu ? 'rtl' : 'ltr'}>
            <div className="text-center mb-4">
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 56, height: 56, background: 'var(--th-accent-light)' }}>
                <Sparkles size={28} className="text-accent" />
              </div>
              <h3 className="font-playfair fw-bold">{t('onboarding.title')}</h3>
              <p className="text-muted small">{t('onboarding.subtitle')}</p>
            </div>
            <div className="d-flex flex-column gap-3">
              {onboardingChoices.map(choice => (
                <button
                  key={choice.path}
                  onClick={() => handleChoice(choice.path)}
                  className={`th-select-btn d-flex align-items-center gap-3 w-100 text-start ${isUrdu ? 'flex-row-reverse text-end' : ''}`}
                >
                  <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48, background: `${choice.iconBg}15`, color: choice.iconBg }}>
                    <choice.icon size={24} />
                  </div>
                  <div className="flex-grow-1">
                    <p className="fw-semibold mb-0 text-dark">{choice.title}</p>
                    <p className="small text-muted mb-0">{choice.desc}</p>
                  </div>
                  <ArrowRight size={20} className={`text-muted ${isUrdu ? 'rotate-180' : ''}`} />
                </button>
              ))}
            </div>
            <button onClick={dismissOnboarding} className="btn btn-link text-muted w-100 mt-3 d-flex align-items-center justify-content-center gap-1 small text-decoration-none">
              <X size={14} /> {t('onboarding.skip')}
            </button>
          </GlassCard>
        </div>
      )}

      <Hero />
      <WhyChooseUs />
      
      {/* Skin Tone Prompt */}
      {showSkinPrompt && (
        <div className={`position-fixed bottom-0 ${isUrdu ? 'start-0' : 'end-0'} p-3 p-md-4`} style={{ zIndex: 9999, maxWidth: 420, width: '100%' }}>
          <GlassCard className={`p-4 shadow-lg anim-fade-up border-accent ${isUrdu ? 'text-end' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
            <h5 className="font-playfair fw-bold mb-2">{t('skintone.prompt.title')}</h5>
            <p className="text-muted small mb-3">
              {t('skintone.prompt.desc')}
            </p>
            <div className={`d-flex flex-wrap gap-2 ${isUrdu ? 'justify-content-start' : ''}`}>
              <Link to="/skin-tone">
                <GradientButton className="btn-sm px-3 py-2">{t('skintone.prompt.now')}</GradientButton>
              </Link>
              <button className="btn btn-outline-secondary btn-sm px-3 py-2" onClick={() => setShowSkinPrompt(false)}>{t('onboarding.skip')}</button>
            </div>
          </GlassCard>
        </div>
      )}
      <FeaturedProducts />
      <HowItWorks />
      <Testimonials />
    </Layout>
  );
};

export default Index;
