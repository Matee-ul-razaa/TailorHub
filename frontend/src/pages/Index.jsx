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
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Palette, ShoppingBag, Ruler, Sparkles, ArrowRight, X } from 'lucide-react';

const SKIN_PROFILE_KEY = 'tailorhub-skin-profile';
const ONBOARDING_KEY = 'tailorhub-onboarding-shown';

const Index = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isUrdu = language === 'ur';
  const navigate = useNavigate();
  const [showSkinPrompt, setShowSkinPrompt] = useState(false);

  useEffect(() => {
    try {
      const profile = JSON.parse(localStorage.getItem(SKIN_PROFILE_KEY) || 'null');
      if (user && !profile?.tone) {
        setShowSkinPrompt(true);
      }
    } catch {
      if (user) setShowSkinPrompt(true);
    }
  }, [user]);

  // Dialog automatically handles body overflow, so we can remove the manual overflow logic
  // useEffect(() => {
  //   if (showOnboarding) {
  //     document.body.style.overflow = 'hidden';
  //   } else {
  //     document.body.style.overflow = '';
  //   }
  //   return () => { document.body.style.overflow = ''; };
  // }, [showOnboarding]);

  return (
    <Layout>
      {/* Skin Tone Prompt Modal */}
      <Dialog open={showSkinPrompt} onOpenChange={setShowSkinPrompt}>
        <DialogContent className="sm:max-w-[420px] p-0 bg-transparent border-0 shadow-none [&>button]:hidden">
          <GlassCard className={`p-4 p-md-5 w-100 ${isUrdu ? 'text-end' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
            <div className="text-center mb-4">
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 56, height: 56, background: 'var(--th-accent-light)' }}>
                <Palette size={28} className="text-accent" />
              </div>
              <h4 className="font-playfair fw-bold mb-2">{t('skintone.prompt.title')}</h4>
              <p className="text-muted small">
                {t('skintone.prompt.desc')}
              </p>
            </div>
            <div className={`d-flex flex-column gap-3`}>
              <Link to="/skin-tone" className="w-100 text-decoration-none" onClick={() => setShowSkinPrompt(false)}>
                <GradientButton className="w-100 py-2">{t('skintone.prompt.now')}</GradientButton>
              </Link>
              <Button variant="ghost" className="w-100 text-muted" onClick={() => setShowSkinPrompt(false)}>
                {t('onboarding.skip')}
              </Button>
            </div>
          </GlassCard>
        </DialogContent>
      </Dialog>

      <Hero />
      <WhyChooseUs />
      <FeaturedProducts />
      <HowItWorks />
      <Testimonials />
    </Layout>
  );
};

export default Index;
