import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/context/CartContext';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/context/StoreContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';

const Cart = () => {
  const navigate = useNavigate();
  const { t, isUrdu } = useLanguage();
  const { items, removeFromCart, updateQuantity, clearCart, totalPrice } = useCart();
  const { placeOrder } = useStore();
  const { fullName, user, session } = useAuth();
  const token = session?.access_token;
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentType, setPaymentType] = useState('full');
  const [processing, setProcessing] = useState(false);
  const [addressDraft, setAddressDraft] = useState({ address: '', city: '', phone: '' });
  const [payMethod, setPayMethod] = useState('card');

  const configuredUnitPrice = (item) => {
    let price = item.product.price;
    if (item.customization?.addWaistcoat) price += 3000;
    if (item.customization?.suitOption === '2-piece') price *= 0.75;
    if (item.customization?.suitOption === 'blazer-only') price *= 0.5;
    if (item.customization?.suitOption === 'pants-only') price *= 0.3;
    if (item.customization?.purchaseMode === 'unstitched') price *= 0.6;
    return Math.round(price);
  };

  const handleCheckoutClick = () => {
    if (!user) { toast.error(t('cart.signInRequired')); return; }
    setIsCheckingOut(true);
  };

  const handleStripePayment = async () => {
    if (!addressDraft.address || !addressDraft.city || !addressDraft.phone) {
      toast.error(t('cart.fillDeliveryDetails'));
      return;
    }
    setProcessing(true);
    try {
      const orderId = await placeOrder({ 
        customerName: fullName || 'Guest Customer', 
        customerEmail: user?.email || 'guest@tailorhub.pk', 
        items, 
        deliveryFee: 250, 
        paymentType,
        deliveryAddress: addressDraft.address,
        deliveryCity: addressDraft.city,
        deliveryPhone: addressDraft.phone,
        paymentMethod: payMethod
      });

      if (payMethod === 'cod') {
        clearCart();
        toast.success(t('cart.orderPlaced'));
        navigate('/tracking?orderId=' + orderId);
        return;
      }

      const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
      const stripeRes = await fetch(`${API_BASE_URL}/api/payments/create-checkout-session`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentType })
      });
      if (!stripeRes.ok) { const err = await stripeRes.json(); throw new Error(err.detail || t('cart.stripeError')); }
      const { url } = await stripeRes.json();
      clearCart();
      window.location.href = url;
    } catch (error) {
      toast.error(error.message || t('cart.checkoutError'));
      setProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container d-flex flex-column align-items-center justify-content-center px-3" style={{ minHeight: '60vh' }}>
          <ShoppingBag size={64} className="text-muted mb-3" style={{ opacity: 0.25 }} />
          <h3 className="font-playfair fw-bold">{t('cart.emptyTitle')}</h3>
          <p className="text-muted mt-1">{t('cart.emptySubtitle')}</p>
          <Link to="/catalog"><Button className="mt-3">{t('cart.browseCollection')}</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`container py-4 ${isUrdu ? 'text-end' : ''}`} dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h2 className="font-playfair fw-bold mb-0">{t('cart.title')}</h2>
          <Button variant="ghost" className="text-danger" onClick={() => { clearCart(); toast.info(t('cart.cartCleared')); }}>{t('cart.clearCart')}</Button>
        </div>

        <div className="row g-4">
          <div className="col-lg-8">
            <div className="d-flex flex-column gap-3">
              {items.map(item => (
                <div key={item.id} className="th-card-static p-3 d-flex gap-3">
                  <div className="rounded-3 overflow-hidden bg-light flex-shrink-0" style={{ width: 80, height: 96 }}>
                    <img src={item.product.image} alt={item.product.name} className="w-100 h-100" style={{ objectFit: 'cover' }}
                      onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }} />
                  </div>
                  <div className="d-flex flex-column justify-content-between flex-grow-1">
                    <div>
                      <h6 className="font-playfair fw-semibold mb-1">{item.product.name}</h6>
                      <p className="text-muted small mb-0">{item.customization?.color} • {item.customization?.size || t('cart.customSize')}</p>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mt-2">
                      <div className="th-qty-control">
                        <button className="th-qty-btn" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}><Minus size={14} /></button>
                        <span className="th-qty-value">{item.quantity}</span>
                        <button className="th-qty-btn" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={14} /></button>
                      </div>
                      <div className="d-flex align-items-center gap-3">
                        <span className="fw-semibold">Rs. {(configuredUnitPrice(item) * item.quantity).toLocaleString()}</span>
                        <Button variant="ghost" size="sm" className="p-0 text-muted" onClick={() => removeFromCart(item.id)}><Trash2 size={16} /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-lg-4">
            <div className="th-card-static p-4 position-sticky" style={{ top: 80 }}>
              <h5 className="font-playfair fw-semibold">{t('cart.orderSummary')}</h5>
              <hr className="th-separator" />
              <div className="d-flex justify-content-between text-muted small mb-2"><span>{t('cart.subtotal')}</span><span>Rs. {totalPrice.toLocaleString()}</span></div>
              <div className="d-flex justify-content-between text-muted small mb-2"><span>{t('cart.delivery')}</span><span>Rs. 250</span></div>
              <hr className="th-separator" />
              <div className="d-flex justify-content-between fw-bold fs-5"><span>{t('cart.total')}</span><span>Rs. {(totalPrice + 250).toLocaleString()}</span></div>

              {isCheckingOut ? (
                <div className="mt-4 p-3 rounded-3" style={{ background: '#f1f3f5', border: '1px solid var(--th-border)' }}>
                  <div className="d-flex flex-column gap-2 mb-3">
                    <input 
                      className="th-input small" 
                      placeholder={t('delivery.address', 'Delivery Address')} 
                      value={addressDraft.address} 
                      onChange={e => setAddressDraft(prev => ({ ...prev, address: e.target.value }))} 
                    />
                    <div className="row g-2">
                      <div className="col-6">
                        <input 
                          className="th-input small" 
                          placeholder={t('delivery.city', 'City')} 
                          value={addressDraft.city} 
                          onChange={e => setAddressDraft(prev => ({ ...prev, city: e.target.value }))} 
                        />
                      </div>
                      <div className="col-6">
                        <input 
                          className="th-input small" 
                          placeholder={t('delivery.phone', 'Phone')} 
                          value={addressDraft.phone} 
                          onChange={e => setAddressDraft(prev => ({ ...prev, phone: e.target.value }))} 
                        />
                      </div>
                    </div>
                  </div>

                  <h6 className="th-label">{t('cart.paymentMethod', 'Payment Method')}</h6>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <button onClick={() => setPayMethod('card')}
                        className={`th-select-btn w-100 text-center ${payMethod === 'card' ? 'selected' : ''}`}>
                        <div className="fw-semibold small">{t('cart.card', 'Online (Card)')}</div>
                      </button>
                    </div>
                    <div className="col-6">
                      <button onClick={() => setPayMethod('cod')}
                        className={`th-select-btn w-100 text-center ${payMethod === 'cod' ? 'selected' : ''}`}>
                        <div className="fw-semibold small">{t('cart.cod', 'COD')}</div>
                      </button>
                    </div>
                  </div>

                  {payMethod === 'card' && (
                    <>
                      <h6 className="th-label">{t('cart.paymentOptions')}</h6>
                      <p className="text-muted small mb-3">{t('cart.advanceOrFull')}</p>
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <button onClick={() => setPaymentType('advance')}
                            className={`th-select-btn w-100 text-center ${paymentType === 'advance' ? 'selected' : ''}`}>
                            <div className="fw-semibold small">{t('cart.advance50')}</div>
                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>Rs. {((totalPrice + 250) / 2).toLocaleString()}</div>
                          </button>
                        </div>
                        <div className="col-6">
                          <button onClick={() => setPaymentType('full')}
                            className={`th-select-btn w-100 text-center ${paymentType === 'full' ? 'selected' : ''}`}>
                            <div className="fw-semibold small">{t('cart.payFull')}</div>
                            <div className="text-muted" style={{ fontSize: '0.72rem' }}>Rs. {(totalPrice + 250).toLocaleString()}</div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    className="w-full h-12 text-base font-semibold"
                    style={{ background: payMethod === 'card' ? '#635BFF' : undefined }}
                    onClick={handleStripePayment}
                    disabled={processing}
                  >
                    {payMethod === 'card' ? <CreditCard size={20} /> : <ShoppingBag size={20} />}
                    {processing ? t('cart.processing') : payMethod === 'card' ? t('cart.payWithStripe') : t('cart.placeCOD')}
                  </Button>
                  <Button variant="ghost" className="w-full mt-2" onClick={() => setIsCheckingOut(false)}>{t('cart.cancel')}</Button>
                </div>
              ) : (
                <Button size="lg" className="w-full mt-4" onClick={handleCheckoutClick}>{t('cart.proceedCheckout')}</Button>
              )}

              {!isCheckingOut && (
                <Link to="/catalog" className="d-flex align-items-center justify-content-center gap-1 mt-3 text-muted small text-decoration-none">
                  <ArrowLeft size={14} className={isUrdu ? 'rotate-180' : ''} /> {t('cart.continueShopping')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Cart;
