import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token;
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    // If it's a mocked test redirect
    if (searchParams.get('mock_order')) {
      const oid = searchParams.get('mock_order');
      const amt = parseFloat(searchParams.get('amount'));
      const pType = searchParams.get('type');
      
      // Hit the simulate webhook since there's no real stripe key available locally
      const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
      fetch(`${API_BASE_URL}/api/payments/simulate_webhook?order_id=${oid}&amount=${amt}&p_type=${pType}`, {
        method: 'POST'
      }).then(() => {
        setOrderId(oid);
        setLoading(false);
      });
    } else {
      // Real Stripe flow (webhook will handle DB async, we just show success)
      const sid = searchParams.get('session_id');
      if (!sid) {
        navigate('/cart');
      } else {
        // Without making a separate route to fetch the order ID from session, 
        // we just mark it generic "Your order was successfully paid".
        setLoading(false);
      }
    }
  }, [searchParams, navigate]);

  return (
    <Layout>
      <div className="d-flex align-items-center justify-content-center p-4" style={{ minHeight: '70vh' }}>
        <div className="th-card-static text-center shadow-lg anim-scale-in" style={{ maxWidth: 440, width: '100%' }}>
          <div className="p-4 p-md-5 d-flex flex-column align-items-center">
            {loading ? (
              <div className="rounded-circle anim-pulse-glow" style={{ width: 64, height: 64, background: 'var(--th-accent-light)' }} />
            ) : (
              <>
                <CheckCircle2 size={64} className="mb-4" style={{ color: '#22c55e' }} />
                <h1 className="font-playfair fw-bold fs-3 mb-2">{t('payment.successTitle', 'Payment Confirmed!')}</h1>
                <p className="text-muted mb-4">
                  {t('payment.successDesc', 'Your payment has been securely processed by Stripe.')}{' '}
                  {orderId && <span>{t('payment.successOrder', 'Your order ID is')} <strong>{orderId}</strong>.</span>}
                  {' '}{t('payment.successKhata', 'The Khata ledger has been successfully updated.')}
                </p>
                <Link to="/tracking" className="w-100 mt-2">
                  <Button size="lg" className="w-100">{t('payment.trackOrder', 'Track My Order')}</Button>
                </Link>
                <Link to="/" className="w-100 mt-2">
                  <Button variant="ghost" className="w-100">{t('payment.returnHome', 'Return to Home')}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PaymentSuccess;
