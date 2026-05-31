import React from "react";
import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { useStore } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import useScrollAnim from '@/hooks/useScrollAnim';
import GlassCard from '@/components/ui/GlassCard';

const FeaturedProducts = () => {
  const { products } = useStore();
  const { t } = useLanguage();
  const featured = products.filter(p => p.featured).slice(0, 4);
  const ref = useScrollAnim();

  return (
    <section className="th-section th-section-muted" ref={ref}>
      <div className="container">
        <div className="d-flex flex-wrap align-items-end justify-content-between mb-5 scroll-anim">
          <div>
            <h2 className="font-playfair fw-bold fs-2 mb-2">
              {t('home.featuredTitle', 'Featured')} <span className="text-accent">{t('home.collection', 'Collection')}</span>
            </h2>
            <p className="text-muted mb-0">{t('home.featuredSubtitle', 'Handpicked pieces for the discerning gentleman')}</p>
          </div>
          <Link to="/catalog" className="d-none d-md-flex align-items-center gap-1 small fw-medium text-accent text-decoration-none hover-lift">
            {t('home.viewAll', 'View All')} <ArrowRight size={16} />
          </Link>
        </div>

        <div className="row g-4">
          {featured.map((product, i) => (
            <div key={product.id} className="col-sm-6 col-lg-3">
              <Link to={`/product/${product.id}`} className="text-decoration-none h-100 d-block">
                <GlassCard className="scroll-anim h-100 d-flex flex-column p-0 overflow-hidden hover-zoom" style={{ transitionDelay: `${i * 0.1}s` }}>
                  <div className="position-relative">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      loading="lazy"
                      className="w-100 object-fit-cover"
                      style={{ aspectRatio: '3/4' }}
                      onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }}
                    />
                    <div className="position-absolute top-0 start-0 w-100 p-3 d-flex justify-content-between align-items-start">
                      <span className="badge bg-dark bg-opacity-75 backdrop-blur px-2 py-1 text-uppercase border" style={{ fontSize: '0.65rem' }}>
                        {product.wearType === 'traditional' ? t('catalog.traditional', 'Traditional') : t('catalog.western', 'Western')}
                      </span>
                      <div className="d-flex align-items-center gap-1 bg-white bg-opacity-75 backdrop-blur px-2 py-1 rounded-pill text-dark" style={{ fontSize: '0.7rem' }}>
                        <Star size={12} className="text-warning" fill="currentColor" /> 4.8
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 d-flex flex-column flex-grow-1">
                    <p className="text-uppercase small text-muted mb-1 fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}>{product.fabric}</p>
                    <h5 className="font-playfair fw-bold mb-3">{product.name}</h5>
                    <div className="d-flex align-items-center justify-content-between mt-auto pt-3 border-top" style={{ borderColor: 'rgba(150,150,150,0.2) !important' }}>
                      <span className="fw-bold fs-5 text-accent">Rs. {product.price.toLocaleString()}</span>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </div>
          ))}
        </div>

        <Link to="/catalog" className="d-flex d-md-none align-items-center justify-content-center gap-1 mt-4 small fw-medium text-accent text-decoration-none">
          {t('home.viewAllCollection', 'View All Collection')} <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
};

export default FeaturedProducts;
