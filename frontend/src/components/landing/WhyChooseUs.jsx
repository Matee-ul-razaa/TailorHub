import React from 'react';
import { ShieldCheck, Clock, Scissors, Award } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import GlassCard from '@/components/ui/GlassCard';

const WhyChooseUs = () => {
  const { language } = useLanguage();
  const isUrdu = language === 'ur';

  const features = [
    {
      icon: Scissors,
      title: isUrdu ? 'پریمیم ٹیلرنگ' : 'Premium Tailoring',
      desc: isUrdu ? 'بہترین کاریگروں کے ذریعے تیار کردہ لباس' : 'Garments crafted by expert artisans with years of experience.'
    },
    {
      icon: Clock,
      title: isUrdu ? 'بروقت ترسیل' : 'On-Time Delivery',
      desc: isUrdu ? 'ہمیشہ وقت پر، آپ کے اہم مواقع کے لیے' : 'Always on time, so you never miss looking your best.'
    },
    {
      icon: ShieldCheck,
      title: isUrdu ? 'کوالٹی کی ضمانت' : 'Quality Guarantee',
      desc: isUrdu ? 'بہترین کپڑا اور پائیدار سلائی' : 'Only the finest fabrics and durable stitching for every order.'
    },
    {
      icon: Award,
      title: isUrdu ? 'بہترین فٹنگ' : 'Perfect Fit',
      desc: isUrdu ? 'آپ کے جسم کے عین مطابق بہترین فٹنگ' : 'Tailored exactly to your measurements for a flawless silhouette.'
    }
  ];

  return (
    <section className="th-section th-section-muted position-relative overflow-hidden">
      <div className="container position-relative" style={{ zIndex: 1 }}>
        <div className="text-center mb-5 anim-fade-up">
          <span className="th-badge th-badge-soft mb-2">{isUrdu ? 'ہمارا معیار' : 'Our Standard'}</span>
          <h2 className="font-playfair fw-bold mb-3">{isUrdu ? 'ہمیں کیوں چنیں؟' : 'Why Choose TailorHub'}</h2>
          <p className="text-muted mx-auto" style={{ maxWidth: 600 }}>
            {isUrdu 
              ? 'ہماری خصوصیات جو ہمیں سب سے الگ اور بہتر بناتی ہیں۔'
              : 'Discover the features that set us apart and make us the premium choice for bespoke tailoring.'}
          </p>
        </div>

        <div className="row g-4 justify-content-center">
          {features.map((feature, idx) => (
            <div key={idx} className="col-md-6 col-lg-3 anim-fade-up" style={{ animationDelay: `${idx * 0.1}s` }}>
              <GlassCard className="h-100 text-center hover-lift p-4 d-flex flex-column align-items-center">
                <div className="rounded-circle d-flex align-items-center justify-content-center mb-4 transition" style={{ width: 64, height: 64, background: 'var(--th-accent-light)', color: 'var(--th-accent)' }}>
                  <feature.icon size={28} />
                </div>
                <h5 className="fw-bold mb-3">{feature.title}</h5>
                <p className="text-muted small mb-0">{feature.desc}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
