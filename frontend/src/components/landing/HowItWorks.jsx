import React from "react";
import { Search, Ruler, Truck } from 'lucide-react';
import useScrollAnim from '@/hooks/useScrollAnim';
import GlassCard from '@/components/ui/GlassCard';
import { useLanguage } from '@/context/LanguageContext';

const getSteps = (isUrdu) => [
  {
    icon: Search,
    title: isUrdu ? 'تلاش کریں اور چنیں' : 'Browse & Choose',
    description: isUrdu ? 'ہمارے پریمیم کپڑوں اور ملبوسات کی کیٹلاگ دیکھیں۔ کیٹیگری، سٹائل یا موقع کے لحاظ سے فلٹر کریں۔' : 'Explore our curated catalog of premium fabrics and garments. Filter by category, style, or occasion.',
  },
  {
    icon: Ruler,
    title: isUrdu ? 'اپنی پسند اور فٹنگ' : 'Customize & Fit',
    description: isUrdu ? 'خریداری کا طریقہ منتخب کریں — کپڑا خریدیں، تیار لباس، یا اپنی پیمائش پر کسٹم سلائی کروائیں۔' : 'Select your purchase mode — buy fabric, ready-to-wear, or get custom-stitched with your measurements.',
  },
  {
    icon: Truck,
    title: isUrdu ? 'آپ کے دروازے پر' : 'Delivered to You',
    description: isUrdu ? 'آپ کا لباس ماہر درزیوں کے ذریعے تیار کر کے آپ کے دروازے پر پہنچایا جاتا ہے۔' : 'Your bespoke garment is crafted by master tailors and delivered right to your doorstep.',
  },
];

const HowItWorks = () => {
  const ref = useScrollAnim();
  const { language } = useLanguage();
  const isUrdu = language === 'ur';
  const steps = getSteps(isUrdu);

  return (
    <section className="th-section position-relative" ref={ref}>
      <div className="container">
        <div className="text-center mb-5 scroll-anim">
          <span className="th-badge th-badge-soft mb-2">{isUrdu ? 'طریقہ کار' : 'Process'}</span>
          <h2 className="font-playfair fw-bold fs-2 mb-2">
            {isUrdu ? (
              <>یہ کیسے کام <span className="text-accent">کرتا ہے</span></>
            ) : (
              <>How It <span className="text-accent">Works</span></>
            )}
          </h2>
          <p className="text-muted mx-auto" style={{ maxWidth: 480 }}>
            {isUrdu ? 'آپ کے بہترین سلے ہوئے لباس تک تین آسان قدم' : 'Three simple steps to your perfectly tailored garment'}
          </p>
        </div>

        <div className="row g-4 justify-content-center" style={{ maxWidth: 1000, margin: '0 auto' }}>
          {steps.map((step, i) => (
            <div key={step.title} className="col-md-4 text-center scroll-anim" style={{ transitionDelay: `${i * 0.15}s` }}>
              <GlassCard className="th-step p-4 h-100 position-relative hover-lift">
                <div 
                  className="position-absolute fs-1 fw-bold opacity-10" 
                  style={{ top: 10, right: 20, zIndex: 0, color: 'var(--th-accent)' }}
                >
                  0{i + 1}
                </div>
                
                <div className="th-step-icon position-relative mx-auto mb-4" style={{ zIndex: 1 }}>
                  <step.icon size={28} />
                </div>
                
                <h5 className="font-playfair fw-bold mb-3 position-relative" style={{ zIndex: 1 }}>{step.title}</h5>
                <p className="text-muted small mb-0 position-relative" style={{ zIndex: 1 }}>{step.description}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
