import { useMemo, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useStore, getOrderProgress } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import useScrollAnim from '@/hooks/useScrollAnim';
import {
  Package, Truck, CheckCircle2, Banknote, MapPin, Phone, User,
  PlayCircle, Loader2, ChevronDown, ChevronUp, History, AlertCircle, Map as MapIcon, X
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import SignatureCanvas from 'react-signature-canvas';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

// Fix for leaflet default icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Small status-to-color map (mirrors AdminDashboard / Tracking conventions)
const STATUS_COLORS = {
  ready:            { bg: 'rgba(20,184,166,0.12)',  color: '#0d9488' },
  out_for_delivery: { bg: 'rgba(6,182,212,0.12)',   color: '#0891b2' },
  delivered:        { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a' },
};

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div
    className="th-card-static p-3 d-flex align-items-center gap-3 scroll-anim"
    style={{ minHeight: 88 }}
  >
    <div
      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
      style={{ width: 48, height: 48, backgroundColor: accent.bg, color: accent.color }}
    >
      <Icon size={22} />
    </div>
    <div className="flex-grow-1 min-w-0">
      <p className="text-muted small mb-1 text-truncate">{label}</p>
      <p className="fw-bold fs-4 mb-0 font-playfair" style={{ color: accent.color }}>{value}</p>
    </div>
  </div>
);

const OrderCard = ({ order, action, t, isUrdu }) => {
  const [expanded, setExpanded] = useState(false);
  const progress = getOrderProgress(order.status);
  const statusStyle = STATUS_COLORS[order.status] || { bg: '#f1f3f5', color: '#6c757d' };

  // Computed: outstanding balance to collect on delivery
  const outstanding = Math.max(0, (order.totalAmount || 0) - (order.amountPaid || 0));
  const hasOutstanding = outstanding > 0;

  // Build a Google Maps URL if we have an address. The current Order model
  // doesn't expose `address` yet — when it's added, it'll just light up.
  // For now we fall back to the customer name, which won't navigate but
  // at least avoids breaking the UI.
  const mapsQuery = encodeURIComponent(order.deliveryAddress || order.address || order.customerName);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div className="th-card-static p-3 p-md-4 scroll-anim" dir={isUrdu ? 'rtl' : 'ltr'}>
      {/* Header row: order id + status badge */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="d-flex align-items-center gap-2">
          <Package size={18} className="text-accent" />
          <span className="font-playfair fw-semibold">{order.id}</span>
        </div>
        <span
          className="th-badge border"
          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, borderColor: statusStyle.color + '33' }}
        >
          {t(`tracking.status.${order.status}`, order.status)}
        </span>
        {order.payment?.method === 'cod' && (
          <span className="th-badge border bg-warning bg-opacity-10 text-warning border-warning border-opacity-25">
            COD
          </span>
        )}
      </div>

      {/* Customer + amount + items */}
      <div className="row g-2 small text-muted mb-3">
        <div className="col-md-6 d-flex align-items-center gap-2">
          <User size={14} className="flex-shrink-0" />
          <span className="text-truncate">
            <span className="fw-medium text-dark">{order.customerName}</span>
          </span>
        </div>
        <div className="col-md-6 d-flex align-items-center gap-2">
          <Package size={14} className="flex-shrink-0" />
          <span>
            {order.items?.length || 0} {t('delivery.items', 'item(s)')} · Rs. {order.totalAmount?.toLocaleString()}
          </span>
        </div>
        {(order.deliveryPhone || order.customerEmail) && (
          <div className="col-md-6 d-flex align-items-center gap-2">
            <Phone size={14} className="flex-shrink-0" />
            <a
              href={`tel:${order.deliveryPhone || ''}`}
              className="text-decoration-none text-muted text-truncate"
              style={{ minWidth: 0 }}
            >
              {order.deliveryPhone || order.customerEmail}
            </a>
          </div>
        )}
        {order.deliveryAddress && (
          <div className="col-md-12 d-flex align-items-start gap-2 mt-1">
            <MapPin size={14} className="flex-shrink-0 mt-1" />
            <span className="text-muted">
              {order.deliveryAddress}, {order.deliveryCity}
            </span>
          </div>
        )}
      </div>

      {/* COD / cash-to-collect alert if money is owed */}
      {hasOutstanding && order.status !== 'delivered' && (
        <div
          className="d-flex align-items-center gap-2 rounded-3 p-2 px-3 mb-3"
          style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}
        >
          <Banknote size={18} style={{ color: '#ca8a04' }} className="flex-shrink-0" />
          <div className="small flex-grow-1">
            <span className="fw-semibold" style={{ color: '#854d0e' }}>
              {t('delivery.collect', 'Collect on delivery')}:{' '}
            </span>
            <span className="fw-bold" style={{ color: '#854d0e' }}>
              Rs. {outstanding.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="d-flex justify-content-between small text-muted mb-1">
          <span>{t('tracking.progress', 'Progress')}</span>
          <span>{progress}%</span>
        </div>
        <div className="th-progress">
          <div className="th-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Item list expandable */}
      {order.items?.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="p-0 text-decoration-none small d-flex align-items-center gap-1 mb-2"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded
              ? <><ChevronUp size={14} /> {t('delivery.hideItems', 'Hide items')}</>
              : <><ChevronDown size={14} /> {t('delivery.showItems', 'Show items')}</>}
          </Button>
          {expanded && (
            <div className="border rounded-3 p-2 mb-3" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
              {order.items.map((item, idx) => (
                <div key={idx} className="d-flex justify-content-between small py-1">
                  <span className="text-truncate me-2">
                    {item.productName} × {item.quantity}
                    {item.color ? ` · ${item.color}` : ''}
                    {item.size ? ` · ${item.size}` : ''}
                  </span>
                  <span className="text-muted flex-shrink-0">
                    Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="small text-muted mb-3 d-flex gap-2">
          <AlertCircle size={14} className="flex-shrink-0 mt-1" />
          <span><span className="fw-medium text-dark">{t('delivery.notes', 'Notes')}: </span>{order.notes}</span>
        </div>
      )}

      {/* Action row: maps link + primary action */}
      <div className="d-flex flex-wrap gap-2 justify-content-end">
        {order.status !== 'delivered' && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
          >
            <MapPin size={14} />
            {t('delivery.openMaps', 'Open in Maps')}
          </a>
        )}
        {action}
      </div>
    </div>
  );
};

const DeliveryDashboard = () => {
  const { fullName, user } = useAuth();
  const { orders, updateOrderStatus, markPaymentPaid } = useStore();
  const { t, language } = useLanguage();
  const isUrdu = language === 'ur';
  const ref = useScrollAnim();

  const [busyOrderId, setBusyOrderId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [signatureModal, setSignatureModal] = useState({ open: false, orderId: null });
  const sigPad = useRef(null);
  
  const [riderLocation, setRiderLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition((position) => {
        setRiderLocation([position.coords.latitude, position.coords.longitude]);
      }, (err) => console.log(err), { enableHighAccuracy: true });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // ── Categorize orders into the three buckets the rider cares about ──────
  const { pickups, onRoute, recentlyDelivered, todayDelivered, cashToCollect } = useMemo(() => {
    const myOrders = orders.filter(o =>
      o.assignedTo === user?.id || (o.status === 'delivered' && o.assignedTo === user?.id)
    );

    const pickups = myOrders.filter(o => o.status === 'ready');
    const onRoute = myOrders.filter(o => o.status === 'out_for_delivery');

    // Recently delivered = last 10
    const recentlyDelivered = myOrders
      .filter(o => o.status === 'delivered')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    // Today's deliveries (for stat card)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDelivered = myOrders.filter(o => {
      if (o.status !== 'delivered') return false;
      const d = o.deliveredAt ? new Date(o.deliveredAt) : new Date(o.createdAt);
      return d >= today;
    }).length;

    // Total cash to collect across active deliveries
    const cashToCollect = [...pickups, ...onRoute].reduce((sum, o) => {
      return sum + Math.max(0, (o.totalAmount || 0) - (o.amountPaid || 0));
    }, 0);

    return { pickups, onRoute, recentlyDelivered, todayDelivered, cashToCollect };
  }, [orders, user?.id]);

  // ── Actions ──
  const handleStartDelivery = async (orderId) => {
    setBusyOrderId(orderId);
    try {
      await updateOrderStatus(orderId, 'out_for_delivery');
      toast.success(t('delivery.startedToast', 'Delivery started'));
    } catch (e) {
      toast.error(e.message || t('delivery.errorGeneric', 'Could not update status'));
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleMarkPaid = async (paymentId) => {
    try {
      await markPaymentPaid(paymentId);
      toast.success('COD payment marked as paid');
    } catch (e) {
      toast.error(e.message || 'Could not mark payment as paid');
    }
  };

  const handleMarkDelivered = (orderId) => {
    setSignatureModal({ open: true, orderId });
  };

  const confirmDeliveryWithSignature = async () => {
    if (!sigPad.current || sigPad.current.isEmpty()) {
      return toast.error("Please provide a customer signature");
    }
    // Note: getTrimmedCanvas() is bugged in react-signature-canvas under Vite,
    // so we use getCanvas() instead which avoids the 'trim-canvas' dependency.
    const signatureImage = sigPad.current.getCanvas().toDataURL("image/png");
    const orderId = signatureModal.orderId;
    
    setBusyOrderId(orderId);
    try {
      await updateOrderStatus(orderId, 'delivered', { signature: signatureImage });
      toast.success(t('delivery.deliveredToast', 'Marked as delivered'));
      setSignatureModal({ open: false, orderId: null });
    } catch (e) {
      toast.error(e.message || t('delivery.errorGeneric', 'Could not update status'));
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <Layout>
      <div
        className={`container py-4 py-md-5 ${isUrdu ? 'text-end' : ''}`}
        ref={ref}
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="mb-4 scroll-anim">
          <h1 className="font-playfair fw-bold fs-2 mb-1">
            {t('delivery.titleA', 'Delivery')}{' '}
            <span className="text-accent">{t('delivery.titleB', 'Panel')}</span>
          </h1>
          <p className="text-muted mb-0">
            {t('delivery.welcome', 'Welcome')}, {fullName || 'Driver'}
          </p>
        </div>

        {/* Stats row */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-lg-3">
            <StatCard
              icon={Package}
              label={t('delivery.statPickups', 'Pickups Pending')}
              value={pickups.length}
              accent={{ bg: 'rgba(20,184,166,0.12)', color: '#0d9488' }}
            />
          </div>
          <div className="col-12 col-sm-6 col-lg-3">
            <StatCard
              icon={Truck}
              label={t('delivery.statOnRoute', 'On Route')}
              value={onRoute.length}
              accent={{ bg: 'rgba(6,182,212,0.12)', color: '#0891b2' }}
            />
          </div>
          <div className="col-12 col-sm-6 col-lg-3">
            <StatCard
              icon={CheckCircle2}
              label={t('delivery.statToday', 'Delivered Today')}
              value={todayDelivered}
              accent={{ bg: 'rgba(34,197,94,0.12)', color: '#16a34a' }}
            />
          </div>
          <div className="col-12 col-sm-6 col-lg-3">
            <StatCard
              icon={Banknote}
              label={t('delivery.statCash', 'Cash to Collect')}
              value={`Rs. ${cashToCollect.toLocaleString()}`}
              accent={{ bg: 'rgba(234,179,8,0.12)', color: '#ca8a04' }}
            />
          </div>
        </div>

        {/* Live Tracking Map Section */}
        {onRoute.length > 0 && (
          <section className="mb-5">
            <div className="d-flex align-items-center justify-content-between mb-3 scroll-anim">
              <div className="d-flex align-items-center gap-2">
                <MapIcon size={20} className="text-accent" />
                <h2 className="font-playfair fw-semibold fs-5 mb-0">Live Tracking Map</h2>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowMap(!showMap)}>
                {showMap ? 'Hide Map' : 'Show Map'}
              </Button>
            </div>
            {showMap && (
              <div className="th-card-static overflow-hidden mb-4 rounded-3 border" style={{ height: 400, zIndex: 0 }}>
                {riderLocation ? (
                  <MapContainer center={riderLocation} zoom={14} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; OpenStreetMap contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={riderLocation}>
                      <Popup>You are here (Live GPS)</Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted bg-light">
                    <Loader2 size={32} className="anim-spin mb-2" />
                    <p>Acquiring GPS location...</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* On-route section (highest priority — actively delivering) */}
        <section className="mb-5">
          <div className="d-flex align-items-center gap-2 mb-3 scroll-anim">
            <Truck size={20} className="text-accent" />
            <h2 className="font-playfair fw-semibold fs-5 mb-0">
              {t('delivery.sectionOnRoute', 'On Route')}
            </h2>
            <span className="th-badge th-badge-soft ms-2">{onRoute.length}</span>
          </div>
          <div className="d-flex flex-column gap-3">
            {onRoute.length === 0 && (
              <p className="text-muted small fst-italic mb-0 scroll-anim">
                {t('delivery.emptyOnRoute', "You're not delivering anything right now.")}
              </p>
            )}
            {onRoute.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                t={t}
                isUrdu={isUrdu}
                action={
                  <div className="d-flex flex-column gap-2">
                    <Button
                      size="sm"
                      className="w-100"
                      onClick={() => handleMarkDelivered(order.id)}
                      disabled={busyOrderId === order.id}
                    >
                      {busyOrderId === order.id
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <CheckCircle2 size={14} />}
                      {t('delivery.markDelivered', 'Mark Delivered')}
                    </Button>
                    {order.payment?.method === 'cod' && order.payment?.status !== 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-100"
                        onClick={() => handleMarkPaid(order.payment.id)}
                      >
                        <Banknote size={14} /> Mark COD Paid
                      </Button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        </section>

        {/* Pickups section (orders ready, waiting for rider to start delivery) */}
        <section className="mb-5">
          <div className="d-flex align-items-center gap-2 mb-3 scroll-anim">
            <Package size={20} className="text-accent" />
            <h2 className="font-playfair fw-semibold fs-5 mb-0">
              {t('delivery.sectionPickups', 'Ready for Pickup')}
            </h2>
            <span className="th-badge th-badge-soft ms-2">{pickups.length}</span>
          </div>
          <div className="d-flex flex-column gap-3">
            {pickups.length === 0 && (
              <p className="text-muted small fst-italic mb-0 scroll-anim">
                {t('delivery.emptyPickups', 'No orders waiting for pickup right now.')}
              </p>
            )}
            {pickups.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                t={t}
                isUrdu={isUrdu}
                action={
                  <Button
                    size="sm"
                    onClick={() => handleStartDelivery(order.id)}
                    disabled={busyOrderId === order.id}
                  >
                    {busyOrderId === order.id
                      ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : <PlayCircle size={14} />}
                    {t('delivery.startDelivery', 'Start Delivery')}
                  </Button>
                }
              />
            ))}
          </div>
        </section>

        {/* Recently delivered (collapsible history) */}
        {recentlyDelivered.length > 0 && (
          <section className="mb-4">
            <Button
              size="sm"
              variant="outline"
              className="d-flex align-items-center gap-2 scroll-anim"
              onClick={() => setShowHistory(s => !s)}
            >
              <History size={16} />
              {showHistory
                ? t('delivery.hideHistory', 'Hide recent history')
                : t('delivery.showHistory', 'Show recent history')}
              <span className="th-badge th-badge-soft ms-1">{recentlyDelivered.length}</span>
            </Button>
            {showHistory && (
              <div className="d-flex flex-column gap-3 mt-3">
                {recentlyDelivered.map(order => (
                  <OrderCard key={order.id} order={order} t={t} isUrdu={isUrdu} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Empty everything state */}
        {pickups.length === 0 && onRoute.length === 0 && recentlyDelivered.length === 0 && (
          <div className="d-flex flex-column align-items-center justify-content-center text-center py-5 scroll-anim">
            <Truck size={64} className="text-muted mb-3" style={{ opacity: 0.25 }} />
            <h5 className="font-playfair fw-semibold">
              {t('delivery.allClear', 'All clear!')}
            </h5>
            <p className="text-muted small">
              {t('delivery.noOrdersAssigned', 'No orders are assigned to you yet. Check back soon.')}
            </p>
          </div>
        )}
      </div>

      {/* Signature Capture Modal overlay */}
      {signatureModal.open && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="bg-white rounded-3 p-4 shadow-lg" style={{ width: '90%', maxWidth: 500 }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="font-playfair fw-bold mb-0">Confirm Delivery</h5>
              <Button variant="ghost" size="sm" className="p-1" onClick={() => setSignatureModal({ open: false, orderId: null })}>
                <X size={20} />
              </Button>
            </div>
            <p className="text-muted small mb-3">Please ask the customer to sign below to confirm receipt of order <strong>{signatureModal.orderId}</strong>.</p>
            
            <div className="border rounded-3 bg-light mb-3" style={{ height: 200 }}>
              <SignatureCanvas
                ref={sigPad}
                penColor="black"
                canvasProps={{ className: 'w-100 h-100' }}
              />
            </div>
            
            <div className="d-flex justify-content-between">
              <Button variant="outline" size="sm" onClick={() => sigPad.current.clear()}>
                Clear Signature
              </Button>
              <Button onClick={confirmDeliveryWithSignature} disabled={busyOrderId === signatureModal.orderId}>
                {busyOrderId === signatureModal.orderId ? <Loader2 size={16} className="anim-spin me-2" /> : null}
                Complete Delivery
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
};

export default DeliveryDashboard;
