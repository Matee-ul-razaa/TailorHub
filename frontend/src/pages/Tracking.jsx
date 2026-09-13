import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useStore, getOrderProgress, getDaysRemaining, getExpectedCompletion } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import { Package, LogIn, CheckCircle2, Scissors, Shirt, Truck, Box, CalendarClock } from 'lucide-react';
import useScrollAnim from '@/hooks/useScrollAnim';
import { Button } from '@/components/ui/button';

const TRACKING_STEPS = [
  { id: 'pending', label: 'Order Placed', icon: Package },
  { id: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { id: 'cutting', label: 'Cutting', icon: Scissors },
  { id: 'stitching', label: 'Stitching', icon: Shirt },
  { id: 'processing', label: 'Processing', icon: Box },
  { id: 'ready', label: 'Ready', icon: Box },
  { id: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: Package },
];

const STATUS_COLORS = {
  pending:    { bg: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: 'rgba(234,179,8,0.2)' },
  confirmed:  { bg: 'rgba(59,130,246,0.1)', color: '#2563eb', border: 'rgba(59,130,246,0.2)' },
  cutting:    { bg: 'rgba(249,115,22,0.1)', color: '#ea580c', border: 'rgba(249,115,22,0.2)' },
  stitching:  { bg: 'rgba(168,85,247,0.1)', color: '#9333ea', border: 'rgba(168,85,247,0.2)' },
  processing: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1', border: 'rgba(99,102,241,0.2)' },
  ready:      { bg: 'rgba(20,184,166,0.1)', color: '#0d9488', border: 'rgba(20,184,166,0.2)' },
  out_for_delivery: { bg: 'rgba(6,182,212,0.1)', color: '#0891b2', border: 'rgba(6,182,212,0.2)' },
  delivered:  { bg: 'rgba(34,197,94,0.1)', color: '#16a34a', border: 'rgba(34,197,94,0.2)' },
  cancelled:  { bg: 'rgba(239,68,68,0.1)', color: '#dc2626', border: 'rgba(239,68,68,0.2)' },
};

const Tracking = () => {
  const { user, hasRole } = useAuth();
  const { orders } = useStore();
  const { t, language } = useLanguage();
  const isUrdu = language === 'ur';
  const ref = useScrollAnim();

  const visibleOrders = !user
    ? []
    : hasRole('admin')
    ? orders
    : hasRole('delivery')
    ? orders.filter(o => o.assignedTo === user.id || o.status === 'delivered')
    : orders.filter(order => order.customerEmail === user.email);

  if (!user) {
    return (
      <Layout>
        <div className="container d-flex flex-column align-items-center justify-content-center gap-3 px-3 text-center" style={{ minHeight: '60vh' }}>
          <LogIn size={64} className="text-muted" style={{ opacity: 0.25 }} />
          <h1 className="font-playfair fw-bold fs-3">{t('tracking.title', 'Order Tracking')}</h1>
          <p className="text-muted">{t('tracking.loginRequired', 'Please sign in to track your orders.')}</p>
          <Link to="/login">
            <Button>{t('nav.login', 'Sign In')}</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`container py-4 py-md-5 ${isUrdu ? 'text-end' : ''}`} ref={ref} dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="mb-5 scroll-anim">
          <h1 className="font-playfair fw-bold fs-2">{t('tracking.title')}</h1>
          <p className="text-muted mt-1">{t('tracking.subtitle')}</p>
        </div>

        <div className="d-flex flex-column gap-3">
          {visibleOrders.length === 0 && (
            <div className="d-flex flex-column align-items-center justify-content-center gap-3 py-5 text-center scroll-anim">
              <Package size={64} className="text-muted" style={{ opacity: 0.25 }} />
              <p className="fw-medium fs-5">{t('tracking.noOrders')}</p>
              <p className="text-muted small">{t('tracking.placeOrderTip')}</p>
              <Link to="/catalog">
                <Button variant="outline">{t('catalog.allProducts')}</Button>
              </Link>
            </div>
          )}

          {visibleOrders.map((order, i) => {
            const progress = getOrderProgress(order.status);
            const statusStyle = STATUS_COLORS[order.status] || { bg: '#f1f3f5', color: 'var(--th-primary)', border: 'var(--th-border)' };
            const daysRemaining = getDaysRemaining(order.status);
            const expected = getExpectedCompletion(order.status);
            const weekdayLabel = expected
              ? expected.toLocaleDateString(isUrdu ? 'ur-PK' : 'en-US', { weekday: 'long' })
              : null;
            const showEta = order.status !== 'delivered' && order.status !== 'cancelled';
            return (
              <div key={order.id} className="th-card-static p-4 scroll-anim" style={{ transitionDelay: `${i * 0.08}s` }}>
                <div className={`d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                  <div className={`d-flex align-items-center gap-2 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                    <Package size={16} className="text-accent" />
                    <span className="font-playfair fw-semibold">{order.id}</span>
                  </div>
                  <span className="th-badge border" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, borderColor: statusStyle.border }}>
                    {t(`tracking.status.${order.status}`, order.status.charAt(0).toUpperCase() + order.status.slice(1))}
                  </span>
                </div>

                {/* Days remaining + expected weekday */}
                {showEta && (
                  <div
                    className={`d-flex flex-wrap align-items-center gap-2 mb-3 p-2 rounded-3 ${isUrdu ? 'flex-row-reverse text-end' : ''}`}
                    style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.25)' }}
                  >
                    <CalendarClock size={16} style={{ color: 'var(--th-accent)' }} />
                    <span className="fw-semibold small" style={{ color: 'var(--th-accent)' }}>
                      {daysRemaining === 0
                        ? t('tracking.deliveryToday', 'Delivery today')
                        : daysRemaining === 1
                        ? t('tracking.oneDayRemaining', '1 day remaining')
                        : `${daysRemaining} ${t('tracking.daysRemaining', 'days remaining')}`}
                    </span>
                    {weekdayLabel && daysRemaining > 0 && (
                      <span className="text-muted small">
                        · {t('tracking.expectedOn', 'expected on')} <strong>{weekdayLabel}</strong>
                      </span>
                    )}
                  </div>
                )}
                <div className={`row g-2 text-muted small mb-3 ${isUrdu ? 'flex-row-reverse text-end' : ''}`}>
                  <div className="col-sm-4">
                    <span className="fw-medium text-dark">{t('admin.fullName')}: </span>
                    {order.customerName}
                  </div>
                  <div className="col-sm-4">
                    <span className="fw-medium text-dark">{t('admin.price')}: </span>
                    Rs. {order.totalAmount.toLocaleString()}
                  </div>
                  <div className="col-sm-4">
                    <span className="fw-medium text-dark">{t('tracking.items')}: </span>
                    {order.items.length}
                  </div>
                </div>
                <div>
                  {/* Desktop Timeline */}
                  {order.status !== 'cancelled' && (
                    <div className="mt-4 pt-2 mb-2 d-none d-md-block overflow-hidden">
                      <div className="d-flex justify-content-between position-relative px-3">
                        {/* Line */}
                        <div className="position-absolute" style={{ top: '16px', left: '5%', right: '5%', height: '4px', background: '#e9ecef', zIndex: 0 }} />
                        <div className="position-absolute" style={{ top: '16px', left: '5%', width: `calc(${progress}% - 10%)`, height: '4px', background: 'var(--th-accent)', zIndex: 1, transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                        
                        {TRACKING_STEPS.map((step, idx) => {
                          const stepIndex = TRACKING_STEPS.findIndex(s => s.id === step.id);
                          const currentIndex = TRACKING_STEPS.findIndex(s => s.id === order.status);
                          
                          const isCompleted = stepIndex <= currentIndex;
                          const isCurrent = stepIndex === currentIndex;
                          const Icon = step.icon;
                          
                          return (
                            <div key={step.id} className="d-flex flex-column align-items-center position-relative" style={{ zIndex: 2, width: '12%', animation: `fadeInUp 0.5s ease forwards ${idx * 0.1}s`, opacity: 0 }}>
                              <div 
                                className={`rounded-circle d-flex align-items-center justify-content-center mb-2 shadow-sm ${isCompleted ? 'bg-accent text-white' : 'bg-white text-muted border'}`}
                                style={{ 
                                  width: '36px', height: '36px', 
                                  transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                  transform: isCurrent ? 'scale(1.2)' : 'scale(1)',
                                  borderColor: isCompleted ? 'var(--th-accent)' : '#dee2e6'
                                }}
                              >
                                <Icon size={16} />
                              </div>
                              <span className={`small text-center ${isCompleted ? 'fw-bold text-dark' : 'text-muted'}`} style={{ fontSize: '0.65rem', lineHeight: '1.2' }}>
                                {step.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                    </div>
                  )}
                  
                  {/* Mobile Timeline or Cancelled Status */}
                  <div className={(order.status === 'cancelled' ? 'd-block' : 'd-md-none') + " mt-3"}>
                    <div className={`d-flex justify-content-between text-muted small mb-1 ${isUrdu ? 'flex-row-reverse' : ''}`}>
                      <span>{t('tracking.progress')}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="th-progress mb-2">
                      <div className="th-progress-bar" style={{ width: `${progress}%`, transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                    </div>
                  </div>
                </div>
                {order.items.length > 0 && (
                  <div className="mt-3 pt-3 border-top">
                    {order.items.map((item, idx) => (
                      <div key={idx} className={`d-flex align-items-center justify-content-between text-muted small ${isUrdu ? 'flex-row-reverse' : ''}`}>
                        <span>{item.productName} × {item.quantity}</span>
                        <span>Rs. {(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default Tracking;
