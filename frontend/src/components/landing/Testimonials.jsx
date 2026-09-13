import React from "react";
import { Star, Quote } from 'lucide-react';
import useScrollAnim from '@/hooks/useScrollAnim';
import GlassCard from '@/components/ui/GlassCard';
import { useLanguage } from '@/context/LanguageContext';

const getTestimonials = (isUrdu) => [
  {
    name: isUrdu ? 'احمد خان' : 'Ahmed Khan',
    role: isUrdu ? 'بزنس ایگزیکٹو' : 'Business Executive',
    text: isUrdu ? 'میں نے TailorHub سے جو کسٹم سوٹ آرڈر کیا وہ بے عیب تھا۔ فٹنگ، کپڑا، اور سلائی — سب کچھ میری توقعات سے بڑھ کر تھا۔' : 'The custom-stitched suit I ordered from TailorHub was impeccable. The fit, the fabric, the finish — everything exceeded my expectations.',
    rating: 5,
    img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=150&h=150'
  },
  {
    name: isUrdu ? 'حسن علی' : 'Hassan Ali',
    role: isUrdu ? 'شادی کے گاہک' : 'Wedding Client',
    text: isUrdu ? 'اپنی شادی کے لیے واسکٹ کے ساتھ شیروانی آرڈر کی۔ کاریگری شاندار تھی۔ مجھے بے شمار داد ملی!' : 'Ordered a sherwani with matching waistcoat for my wedding. The craftsmanship was outstanding. I received countless compliments!',
    rating: 5,
    img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fit=crop&w=150&h=150'
  },
  {
    name: isUrdu ? 'عمر شیخ' : 'Omar Sheikh',
    role: isUrdu ? 'مستقل گاہک' : 'Regular Customer',
    text: isUrdu ? 'مجھے بغیر سلا کپڑا خریدنے اور اسے اپنی مرضی کے مطابق سلوانے کا آپشن بہت پسند آیا۔ ورچوئل ٹرائی آن فیچر زبردست ہے۔' : 'I love the option to buy unstitched fabric and get it custom-tailored. The virtual try-on feature is a game changer.',
    rating: 4,
    img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?fit=crop&w=150&h=150'
  },
];

const Testimonials = () => {
  const ref = useScrollAnim();
  const { language } = useLanguage();
  const isUrdu = language === 'ur';
  const testimonials = getTestimonials(isUrdu);

  return (
    <section className="th-section position-relative" ref={ref}>
      <div className="container">
        <div className="text-center mb-5 scroll-anim">
          <span className="th-badge th-badge-soft mb-2">{isUrdu ? 'تاثرات' : 'Testimonials'}</span>
          <h2 className="font-playfair fw-bold fs-2 mb-2">
            {isUrdu ? (
              <>ہمارے <span className="text-accent">گاہکوں</span> کے خیالات</>
            ) : (
              <>What Our <span className="text-accent">Clients</span> Say</>
            )}
          </h2>
          <p className="text-muted">{isUrdu ? 'ہزاروں مطمئن گاہکوں کا اعتماد' : 'Trusted by thousands of satisfied gentlemen'}</p>
        </div>

        <div className="row g-4 justify-content-center" style={{ maxWidth: 1000, margin: '0 auto' }}>
          {testimonials.map((t, i) => (
            <div key={t.name} className="col-md-4 scroll-anim" style={{ transitionDelay: `${i * 0.15}s` }}>
              <GlassCard className="h-100 p-4 position-relative hover-lift" style={{ borderTop: '4px solid var(--th-accent)' }}>
                <Quote size={40} className="position-absolute text-accent" style={{ top: 20, right: 20, opacity: 0.1 }} />
                
                <div className="d-flex gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star 
                      key={j} 
                      size={16} 
                      className={j < t.rating ? 'text-warning' : 'text-secondary'} 
                      fill={j < t.rating ? 'currentColor' : 'none'} 
                    />
                  ))}
                </div>
                
                <p className="small mb-4 text-muted" style={{ lineHeight: 1.8 }}>
                  "{t.text}"
                </p>
                
                <div className="d-flex align-items-center gap-3 mt-auto">
                  <img 
                    src={t.img} 
                    alt={t.name} 
                    className="rounded-circle object-fit-cover shadow-sm"
                    style={{ width: 48, height: 48 }}
                  />
                  <div>
                    <div className="fw-bold">{t.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{t.role}</div>
                  </div>
                </div>
              </GlassCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
