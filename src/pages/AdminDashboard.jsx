import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, ShoppingBag, Trash2, Users, Package, TrendingUp, FileText, BookOpen, Download, Settings, KeyRound, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { categories } from '@/data/products';
import useScrollAnim from '@/hooks/useScrollAnim';
import { apiRequest } from '@/lib/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const ORDER_STATUSES = ['pending', 'confirmed', 'cutting', 'stitching', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

const STATUS_COLORS = {
  pending:    { bg: 'rgba(234,179,8,0.1)', color: '#ca8a04' },
  confirmed:  { bg: 'rgba(59,130,246,0.1)', color: '#2563eb' },
  cutting:    { bg: 'rgba(249,115,22,0.1)', color: '#ea580c' },
  stitching:  { bg: 'rgba(168,85,247,0.1)', color: '#9333ea' },
  processing: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
  ready:      { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
  out_for_delivery: { bg: 'rgba(6,182,212,0.1)', color: '#0891b2' },
  delivered:  { bg: 'rgba(34,197,94,0.1)', color: '#16a34a' },
  cancelled:  { bg: 'rgba(239,68,68,0.1)', color: '#dc2626' },
};

const emptyProduct = {
  name: '',
  description: '',
  price: 0,
  category: 'shirts',
  wearType: 'western',
  image: '',
  availableModes: ['ready-to-wear', 'custom-stitching'],
  fabric: '',
  colors: ['Black', 'Navy'],
  sizes: ['M', 'L'],
  featured: false,
};

const AdminDashboard = () => {
  const { fullName, session } = useAuth();
  const token = session?.access_token;
  const { t } = useLanguage();
  const ref = useScrollAnim();
  const navigate = useNavigate();
  const {
    products,
    orders,
    teamMembers,
    addProduct,
    updateProduct,
    deleteProduct,
    updateOrderStatus,
    assignOrder,
    deleteOrder,
    addTeamMember,
    updateTeamMemberRole,
    deleteTeamMember,
    inventory,
    addInventoryItem,
    deductStock,
    expenses,
    recordExpense,
    addKhataEntry,
    khataSummary,
    invoices,
    emailInvoice,
    markInvoicePaid,
  } = useStore();

  const [productDraft, setProductDraft] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);
  const [memberDraft, setMemberDraft] = useState({ fullName: '', email: '', role: 'customer' });
  const [invDraft, setInvDraft] = useState({ name: '', quantity: 0, price_per_unit: 0, unit: 'meters', threshold: 10 });
  const [expDraft, setExpDraft] = useState({ category: '', amount: 0, description: '' });
  const [khataDraft, setKhataDraft] = useState({ customer_id: '', type: 'payment', amount: 0, notes: '', order_id: '' });

  const [analyticsData, setAnalyticsData] = useState({
    ordersByMonth: [],
    popularCategories: [],
    repeatRate: { repeat_rate: 0, repeat_customers: 0, total_customers: 0 },
    avgLeadTime: { avg_lead_time_days: 0 },
    loading: true,
    error: null,
  });

  const fetchAnalytics = async () => {
    try {
      setAnalyticsData(prev => ({ ...prev, loading: true, error: null }));
      const [ordersByMonth, popularCategories, repeatRate, avgLeadTime] = await Promise.all([
        apiRequest('/api/analytics/orders-by-month'),
        apiRequest('/api/analytics/popular-categories'),
        apiRequest('/api/analytics/repeat-rate'),
        apiRequest('/api/analytics/avg-lead-time'),
      ]);
      setAnalyticsData({
        ordersByMonth,
        popularCategories,
        repeatRate,
        avgLeadTime,
        loading: false,
        error: null,
      });
    } catch (err) {
      setAnalyticsData(prev => ({
        ordersByMonth: [],
        popularCategories: [],
        repeatRate: { repeat_rate: 0, repeat_customers: 0, total_customers: 0 },
        avgLeadTime: { avg_lead_time_days: 0 },
        loading: false,
        error: err.message,
      }));
    }
  };

  useEffect(() => {
    if (token) {
      fetchAnalytics();
    }
  }, [token]);

  const splitCsv = value =>
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

  // ── Khata (Ledger) calculations ──
  const khataData = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const deliveredRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.totalAmount, 0);
    const pendingRevenue = totalRevenue - deliveredRevenue;
    const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));

    return {
      totalRevenue,
      deliveredRevenue,
      pendingRevenue,
      activeOrders,
      totalOrders: orders.length,
      cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
    };
  }, [orders]);

  const stats = useMemo(() => {
    const outstandingInvoices = (invoices || []).filter(i => i.status !== 'paid' && i.status !== 'cancelled');
    const outstandingAmount = outstandingInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    
    return [
      { label: t('admin.stats.totalOrders', 'Total Orders'), value: String(orders.length), icon: ShoppingBag },
      { label: t('admin.stats.outstandingInvoices', 'Outstanding Invoices'), value: `${outstandingInvoices.length} (Rs. ${outstandingAmount.toLocaleString()})`, icon: FileText },
      { label: t('admin.products', 'Products'), value: String(products.length), icon: Package },
      { label: t('admin.stats.revenue', 'Revenue'), value: `Rs. ${khataSummary.total_revenue.toLocaleString()}`, icon: TrendingUp },
    ];
  }, [orders, invoices, products, t, khataSummary]);

  const submitProduct = async () => {
    if (!productDraft.name || !productDraft.description || !productDraft.price || !productDraft.fabric || !productDraft.category) {
      toast.error(t('admin.error.requiredProductFields', 'Please fill all required product fields'));
      return;
    }
    try {
      const payload = {
        ...productDraft,
        image: productDraft.image || '/placeholder.svg',
        colors: splitCsv(Array.isArray(productDraft.colors) ? productDraft.colors.join(', ') : productDraft.colors),
        sizes: splitCsv(Array.isArray(productDraft.sizes) ? productDraft.sizes.join(', ') : productDraft.sizes),
        availableModes: splitCsv(Array.isArray(productDraft.availableModes) ? productDraft.availableModes.join(', ') : productDraft.availableModes),
      };
      if (editingProductId) {
        await updateProduct({ id: editingProductId, ...payload });
        toast.success(t('admin.success.productUpdated', 'Product updated'));
      } else {
        await addProduct(payload);
        toast.success(t('admin.success.productAdded', 'Product added'));
      }
      setProductDraft(emptyProduct);
      setEditingProductId(null);
    } catch (error) {
      toast.error(error.message || t('admin.error.productSaveFailed', 'Unable to save product'));
    }
  };

  const startEditProduct = product => {
    setEditingProductId(product.id);
    setProductDraft({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      wearType: product.wearType,
      image: product.image || '',
      availableModes: (product.availableModes || []).join(', '),
      fabric: product.fabric || '',
      colors: (product.colors || []).join(', '),
      sizes: (product.sizes || []).join(', '),
      featured: !!product.featured,
    });
  };

  const submitMember = async () => {
    if (!memberDraft.fullName || !memberDraft.email) {
      toast.error(t('admin.error.memberNameEmail', 'Please enter member name and email'));
      return;
    }
    try {
      await addTeamMember(memberDraft);
      setMemberDraft({ fullName: '', email: '', role: 'customer' });
      toast.success(t('admin.success.memberAdded', 'Team member added'));
    } catch (error) {
      toast.error(error.message || t('admin.error.memberAddFailed', 'Unable to add member'));
    }
  };

  const downloadInvoice = async (orderId) => {
    try {
      const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        toast.success('Invoice preview opened in new tab');
      } else {
        toast.error('Failed to generate invoice');
      }
    } catch {
      toast.error('Invoice system requires backend connection (Python API)');
    }
  };

  return (
    <Layout>
      <div className="container py-4 py-md-5" ref={ref}>
        <div className="mb-5 scroll-anim">
          <h1 className="font-playfair fw-bold fs-2">
            {t('admin.titleA', 'Admin')} <span className="text-accent">{t('admin.titleB', 'Dashboard')}</span>
          </h1>
          <p className="text-muted mt-1">{t('admin.welcome', 'Welcome back')}, {fullName || t('admin.titleA', 'Admin')}</p>
        </div>

        <div className="row g-3 mb-5 scroll-anim">
          {stats.map(stat => (
            <div key={stat.label} className="col-sm-6 col-lg-3">
              <div className="th-card-static p-4 d-flex align-items-center gap-3 hover-lift">
                <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, background: 'var(--th-accent-light)', color: 'var(--th-accent)' }}>
                  <stat.icon size={24} />
                </div>
                <div>
                  <p className="text-muted small mb-0">{stat.label}</p>
                  <p className="fw-bold fs-4 mb-0">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="analytics" className="mt-4">
          <TabsList>
            <TabsTrigger value="analytics"><TrendingUp size={14} className="me-1" /> {t('admin.analytics.tab', 'Analytics')}</TabsTrigger>
            <TabsTrigger value="orders">{t('admin.orders', 'Orders')}</TabsTrigger>
            <TabsTrigger value="khata"><BookOpen size={14} className="me-1" /> Khata</TabsTrigger>
            <TabsTrigger value="invoices"><FileText size={14} className="me-1" /> Invoices</TabsTrigger>
            <TabsTrigger value="inventory"><Package size={14} className="me-1" /> Inventory</TabsTrigger>
            <TabsTrigger value="products">{t('admin.products', 'Products')}</TabsTrigger>
            <TabsTrigger value="roles">{t('admin.roles', 'Team')}</TabsTrigger>
            <TabsTrigger value="settings"><Settings size={14} className="me-1" /> Settings</TabsTrigger>
          </TabsList>

          {/* ── ANALYTICS TAB ── */}
          <TabsContent value="analytics">
            {analyticsData.loading ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-5">
                <Loader2 className="anim-spin text-accent mb-3" size={32} />
                <p className="text-muted">{t('admin.analytics.loading', 'Loading analytics data...')}</p>
              </div>
            ) : analyticsData.error ? (
              <div className="alert alert-danger p-4 text-center my-4">
                <p className="mb-0">{t('admin.analytics.error', 'Failed to load analytics')}: {analyticsData.error}</p>
              </div>
            ) : (!analyticsData.ordersByMonth.length && !analyticsData.popularCategories.length) ? (
              <div className="th-card-static p-5 text-center text-muted">
                <p className="mb-0">{t('admin.analytics.noData', 'No analytics data available to display')}</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-4">
                {/* KPI Cards */}
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="th-card-static p-4 d-flex align-items-center gap-3 hover-lift h-100">
                      <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56, background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}>
                        <Users size={28} />
                      </div>
                      <div>
                        <p className="text-muted small mb-1">{t('admin.analytics.repeatRate', 'Repeat Customer Rate')}</p>
                        <p className="fw-bold fs-3 mb-0 text-dark">{analyticsData.repeatRate.repeat_rate}%</p>
                        <p className="text-muted x-small mt-1 mb-0">
                          {t('admin.analytics.repeatRateDesc', 'Percentage of customers who placed 2 or more orders')}
                        </p>
                        <p className="text-accent x-small fw-medium mt-1 mb-0">
                          {analyticsData.repeatRate.repeat_customers} / {analyticsData.repeatRate.total_customers} {t('admin.analytics.repeatCustomers', 'Repeat Customers')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="th-card-static p-4 d-flex align-items-center gap-3 hover-lift h-100">
                      <div className="rounded-3 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56, background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                        <Clock size={28} />
                      </div>
                      <div>
                        <p className="text-muted small mb-1">{t('admin.analytics.avgLeadTime', 'Average Lead Time')}</p>
                        <p className="fw-bold fs-3 mb-0 text-dark">
                          {analyticsData.avgLeadTime.avg_lead_time_days} {t('admin.analytics.days', 'Days')}
                        </p>
                        <p className="text-muted x-small mt-1 mb-0">
                          {t('admin.analytics.avgLeadTimeDesc', 'Average days from order confirmation to delivery')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts Grid */}
                <div className="row g-4 mb-4">
                  {/* Monthly Trend */}
                  <div className="col-lg-7">
                    <div className="th-card-static p-4 h-100">
                      <h5 className="font-playfair fw-semibold mb-4">{t('admin.analytics.ordersByMonth', 'Monthly Orders & Revenue')}</h5>
                      <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer>
                          <LineChart
                            data={analyticsData.ordersByMonth}
                            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
                            <XAxis dataKey="month" stroke="#868e96" fontSize={11} tickLine={false} />
                            <YAxis yAxisId="left" stroke="#2563eb" fontSize={11} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" stroke="#ea580c" fontSize={11} tickLine={false} />
                            <Tooltip
                              contentStyle={{ background: '#ffffff', border: '1px solid #dee2e6', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                              labelClassName="fw-bold text-dark"
                            />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="revenue"
                              name={t('admin.analytics.revenue', 'Revenue (Rs.)')}
                              stroke="#2563eb"
                              strokeWidth={3}
                              activeDot={{ r: 8 }}
                              dot={{ r: 4 }}
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="count"
                              name={t('admin.analytics.orders', 'Orders Count')}
                              stroke="#ea580c"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Popular Categories */}
                  <div className="col-lg-5">
                    <div className="th-card-static p-4 h-100">
                      <h5 className="font-playfair fw-semibold mb-4">{t('admin.analytics.popularCategories', 'Popular Garment Categories')}</h5>
                      <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer>
                          <BarChart
                            data={analyticsData.popularCategories}
                            margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
                            <XAxis dataKey="category" stroke="#868e96" fontSize={11} tickLine={false} />
                            <YAxis stroke="#868e96" fontSize={11} tickLine={false} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: '#ffffff', border: '1px solid #dee2e6', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                              labelClassName="fw-bold text-dark"
                            />
                            <Bar dataKey="value" name={t('admin.analytics.categoryCount', 'Items Ordered')} fill="#9333ea" radius={[4, 4, 0, 0]}>
                              {analyticsData.popularCategories.map((entry, index) => {
                                const colors = ['#9333ea', '#2563eb', '#059669', '#ea580c', '#6366f1', '#17a2b8'];
                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── ORDERS TAB ── */}
          <TabsContent value="orders">
            <div className="th-card-static p-4">
              <h5 className="font-playfair fw-semibold mb-3">{t('admin.orderManagement', 'Order Management')}</h5>
              <div className="d-flex flex-column gap-3">
                {orders.length === 0 && <p className="py-5 text-center text-muted">No orders yet</p>}
                {orders.map(order => {
                  const sc = STATUS_COLORS[order.status] || { bg: '#f1f3f5', color: '#6c757d' };
                  return (
                    <div key={order.id} className="rounded-3 border p-4">
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                        <div>
                          <p className="fw-semibold mb-0">{order.id} • {order.customerName}</p>
                          <p className="text-muted small mb-0">
                            {order.customerEmail} • Rs. {order.totalAmount.toLocaleString()}
                            {order.deliveryAddress && ` • ${order.deliveryAddress}, ${order.deliveryCity}`}
                            {order.deliveryPhone && ` • ${order.deliveryPhone}`}
                          </p>
                        </div>
                        <span className="th-badge" style={{ backgroundColor: sc.bg, color: sc.color }}>
                          {order.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="row g-2">
                        {/* Status Dropdown */}
                        <div className="col-md-3">
                          <select className="th-select" value={order.status}
                            onChange={async e => { try { await updateOrderStatus(order.id, e.target.value); } catch (error) { toast.error(error.message || 'Unable to update status'); } }}>
                            {ORDER_STATUSES.map(status => (
                              <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        {/* Assign Delivery */}
                        <div className="col-md-3">
                          <select className="th-select" value={order.assignedTo || 'unassigned'}
                            onChange={async e => { try { await assignOrder(order.id, e.target.value === 'unassigned' ? '' : e.target.value); } catch (error) { toast.error(error.message || 'Unable to assign'); } }}>
                            <option value="unassigned">Unassigned</option>
                            {teamMembers.filter(m => m.role === 'delivery').map(m => (
                              <option key={m.id} value={m.id}>{m.fullName}</option>
                            ))}
                          </select>
                        </div>
                        {/* Generate Invoice */}
                        <div className="col-md-3">
                          <button className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2" onClick={() => downloadInvoice(order.id)}>
                            <FileText size={16} /> Invoice
                          </button>
                        </div>
                        {/* Delete Order */}
                        <div className="col-md-3">
                          <button className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2" onClick={async () => { if(window.confirm('Delete this order?')) { try { await deleteOrder(order.id); toast.success('Order deleted'); } catch (error) { toast.error(error.message || 'Unable to delete'); } } }}>
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ── KHATA (LEDGER) TAB ── */}
          <TabsContent value="khata">
            <div className="row g-3 mb-4">
              <div className="col-sm-3">
                <div className="th-card-static p-4" style={{ background: 'rgba(34,197,94,0.04)' }}>
                  <p className="th-label">Total Revenue</p>
                  <p className="fw-bold fs-4 mb-0" style={{ color: '#16a34a' }}>Rs. {khataSummary.total_revenue.toLocaleString()}</p>
                </div>
              </div>
              <div className="col-sm-3">
                <div className="th-card-static p-4" style={{ background: 'rgba(239,68,68,0.04)' }}>
                  <p className="th-label">Total Expenses</p>
                  <p className="fw-bold fs-4 mb-0" style={{ color: '#dc2626' }}>Rs. {khataSummary.total_expenses.toLocaleString()}</p>
                </div>
              </div>
              <div className="col-sm-3">
                <div className="th-card-static p-4" style={{ background: 'rgba(59,130,246,0.04)' }}>
                  <p className="th-label">Outstanding</p>
                  <p className="fw-bold fs-4 mb-0" style={{ color: '#2563eb' }}>Rs. {khataSummary.outstanding_balance.toLocaleString()}</p>
                </div>
              </div>
              <div className="col-sm-3">
                <div className="th-card-static p-4" style={{ background: 'rgba(168,85,247,0.04)' }}>
                  <p className="th-label">Net Profit</p>
                  <p className="fw-bold fs-4 mb-0" style={{ color: '#9333ea' }}>Rs. {khataSummary.net_profit.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="row g-4">
              {/* Record Entry Forms */}
              <div className="col-lg-4">
                <div className="th-card-static p-4 mb-4">
                  <h6 className="fw-bold mb-3">Record Khata Entry</h6>
                  <div className="d-flex flex-column gap-3">
                    <select className="th-select" value={khataDraft.customer_id} onChange={e => setKhataDraft(prev => ({ ...prev, customer_id: e.target.value, order_id: '' }))}>
                      <option value="">Select Customer</option>
                      {teamMembers.map(m => <option key={m.id} value={m.id}>{m.fullName || m.email}</option>)}
                    </select>
                    {khataDraft.customer_id && (
                      <select className="th-select" value={khataDraft.order_id} onChange={e => setKhataDraft(prev => ({ ...prev, order_id: e.target.value }))}>
                        <option value="">No Linked Order</option>
                        {orders.filter(o => o.customer_id === khataDraft.customer_id).map(o => (
                          <option key={o.id} value={o.id}>
                            {o.id} — Rs. {o.total_amount} (Paid: Rs. {o.amount_paid})
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="row g-2">
                      <div className="col-6">
                        <select className="th-select" value={khataDraft.type} onChange={e => setKhataDraft(prev => ({ ...prev, type: e.target.value }))}>
                          <option value="payment">Payment In</option>
                          <option value="credit">Credit Out</option>
                        </select>
                      </div>
                      <div className="col-6">
                        <input className="th-input" type="number" placeholder="Amount" value={khataDraft.amount || ''} onChange={e => setKhataDraft(prev => ({ ...prev, amount: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <input className="th-input" placeholder="Notes (Optional)" value={khataDraft.notes} onChange={e => setKhataDraft(prev => ({ ...prev, notes: e.target.value }))} />
                    <button className="btn btn-accent w-100" onClick={async () => {
                      if(!khataDraft.customer_id || !khataDraft.amount) return toast.error('Fill required fields');
                      try { await addKhataEntry({ ...khataDraft, order_id: khataDraft.order_id || null }); setKhataDraft({ customer_id: '', type: 'payment', amount: 0, notes: '', order_id: '' }); toast.success('Entry recorded'); } catch(e) { toast.error(e.message); }
                    }}>Record Entry</button>
                  </div>
                </div>

                <div className="th-card-static p-4">
                  <h6 className="fw-bold mb-3">Record Expense</h6>
                  <div className="d-flex flex-column gap-3">
                    <input className="th-input" placeholder="Category (e.g. Rent)" value={expDraft.category} onChange={e => setExpDraft(prev => ({ ...prev, category: e.target.value }))} />
                    <input className="th-input" type="number" placeholder="Amount" value={expDraft.amount || ''} onChange={e => setExpDraft(prev => ({ ...prev, amount: Number(e.target.value) }))} />
                    <input className="th-input" placeholder="Description" value={expDraft.description} onChange={e => setExpDraft(prev => ({ ...prev, description: e.target.value }))} />
                    <button className="btn btn-outline-danger w-100" onClick={async () => {
                      if(!expDraft.category || !expDraft.amount) return toast.error('Fill required fields');
                      try { await recordExpense(expDraft); setExpDraft({ category: '', amount: 0, description: '' }); toast.success('Expense recorded'); } catch(e) { toast.error(e.message); }
                    }}>Add Expense</button>
                  </div>
                </div>
              </div>

              {/* Lists */}
              <div className="col-lg-8">
                <div className="th-card-static p-4 mb-4">
                  <h6 className="fw-bold mb-3">Recent Expenses</h6>
                  <div className="table-responsive">
                    <table className="table table-borderless small mb-0">
                      <thead>
                        <tr className="border-bottom">
                          <th className="text-muted pb-2">Category</th>
                          <th className="text-muted pb-2 text-end">Amount</th>
                          <th className="text-muted pb-2 text-end">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.slice(0, 5).map(exp => (
                          <tr key={exp.id} className="border-bottom" style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                            <td className="py-2">{exp.category} <div className="text-muted x-small">{exp.description}</div></td>
                            <td className="py-2 text-end fw-medium text-danger">Rs. {exp.amount.toLocaleString()}</td>
                            <td className="py-2 text-end text-muted">{new Date(exp.expense_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="th-card-static p-4">
                  <h6 className="fw-bold mb-3">Order Settlement Status</h6>
                  <div className="table-responsive">
                    <table className="table table-borderless small mb-0">
                      <thead>
                        <tr className="border-bottom">
                          <th className="text-muted pb-2">Order / Customer</th>
                          <th className="text-muted pb-2 text-end">Total</th>
                          <th className="text-muted pb-2 text-end">Paid</th>
                          <th className="text-muted pb-2 text-end">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(order => (
                          <tr key={order.id} className="border-bottom" style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                            <td className="py-2">
                              <div className="fw-medium">{order.id}</div>
                              <div className="text-muted">{order.customerName}</div>
                            </td>
                            <td className="py-2 text-end">Rs. {order.totalAmount.toLocaleString()}</td>
                            <td className="py-2 text-end text-success">Rs. {order.amountPaid.toLocaleString()}</td>
                            <td className="py-2 text-end fw-bold" style={{ color: (order.totalAmount - order.amountPaid) > 0 ? '#d97706' : '#16a34a' }}>
                              Rs. {(order.totalAmount - order.amountPaid).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── INVOICES TAB ── */}
          <TabsContent value="invoices">
            <div className="th-card-static p-4">
              <h5 className="font-playfair fw-semibold mb-3">Invoice Management</h5>
              <div className="table-responsive">
                <table className="table table-borderless small mb-0">
                  <thead>
                    <tr className="border-bottom">
                      <th className="text-muted pb-2">Invoice #</th>
                      <th className="text-muted pb-2">Order / Type</th>
                      <th className="text-muted pb-2 text-end">Amount</th>
                      <th className="text-muted pb-2 text-center">Status</th>
                      <th className="text-muted pb-2 text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoices || []).map(inv => (
                      <tr key={inv.id} className="border-bottom align-middle" style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                        <td className="py-3 font-monospace fw-medium text-dark">{inv.invoice_number}</td>
                        <td className="py-3">
                          <div className="fw-medium">{inv.order_id}</div>
                          <div className="text-muted x-small text-uppercase">{inv.type} Invoice</div>
                        </td>
                        <td className="py-3 text-end fw-bold" style={{ color: 'var(--th-primary)' }}>Rs. {inv.total_amount.toLocaleString()}</td>
                        <td className="py-3 text-center">
                          <span className={`th-badge bg-${inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : 'warning'} bg-opacity-10 text-${inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : 'warning'}`}>
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="d-flex align-items-center justify-content-end gap-2">
                            <button className="btn btn-outline-secondary btn-sm" onClick={() => downloadInvoice(inv.order_id)}>
                              Preview PDF
                            </button>
                            <button className="btn btn-outline-accent btn-sm" onClick={async () => {
                              try {
                                await emailInvoice(inv.invoice_number);
                                toast.success('Email receipt sent successfully');
                              } catch(e) { toast.error('Failed to send email'); }
                            }}>
                              Email Receipt
                            </button>
                            {inv.status !== 'paid' && (
                              <button className="btn btn-success btn-sm" onClick={async () => {
                                if(window.confirm('Mark this invoice as manually paid (e.g. COD)?')) {
                                  try {
                                    await markInvoicePaid(inv.invoice_number);
                                    toast.success('Invoice marked as paid');
                                  } catch(e) { toast.error('Failed to mark paid'); }
                                }
                              }}>
                                Mark Paid
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!invoices || invoices.length === 0) && <tr><td colSpan={5} className="py-5 text-center text-muted">No invoices generated yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* ── INVENTORY TAB ── */}
          <TabsContent value="inventory">
            <div className="row g-4">
              <div className="col-lg-4">
                <div className="th-card-static p-4">
                  <h5 className="font-playfair fw-semibold mb-3">Add New Stock</h5>
                  <div className="d-flex flex-column gap-3">
                    <input className="th-input" placeholder="Item Name (e.g. Cotton White)" value={invDraft.name} onChange={e => setInvDraft(prev => ({ ...prev, name: e.target.value }))} />
                    <div className="row g-2">
                      <div className="col-6">
                        <input className="th-input" type="number" placeholder="Quantity" value={invDraft.quantity || ''} onChange={e => setInvDraft(prev => ({ ...prev, quantity: Number(e.target.value) }))} />
                      </div>
                      <div className="col-6">
                        <input className="th-input" placeholder="Unit (meters)" value={invDraft.unit} onChange={e => setInvDraft(prev => ({ ...prev, unit: e.target.value }))} />
                      </div>
                    </div>
                    <input className="th-input" type="number" placeholder="Price per unit" value={invDraft.price_per_unit || ''} onChange={e => setInvDraft(prev => ({ ...prev, price_per_unit: Number(e.target.value) }))} />
                    <input className="th-input" type="number" placeholder="Low Stock Threshold" value={invDraft.threshold || ''} onChange={e => setInvDraft(prev => ({ ...prev, threshold: Number(e.target.value) }))} />
                    <button className="btn btn-accent w-100" onClick={async () => {
                      if(!invDraft.name || !invDraft.quantity) return toast.error('Fill required fields');
                      try { await addInventoryItem(invDraft); setInvDraft({ name: '', quantity: 0, price_per_unit: 0, unit: 'meters', threshold: 10 }); toast.success('Item added'); } catch(e) { toast.error(e.message); }
                    }}>Add to Inventory</button>
                  </div>
                </div>
              </div>

              <div className="col-lg-8">
                <div className="th-card-static p-4">
                  <h5 className="font-playfair fw-semibold mb-3">Current Inventory</h5>
                  <div className="table-responsive">
                    <table className="table table-borderless small mb-0">
                      <thead>
                        <tr className="border-bottom">
                          <th className="text-muted pb-2">Item Name</th>
                          <th className="text-muted pb-2 text-center">Stock</th>
                          <th className="text-muted pb-2 text-end">Price/Unit</th>
                          <th className="text-muted pb-2 text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map(item => {
                          const isLow = item.quantity <= item.threshold;
                          return (
                            <tr key={item.id} className="border-bottom" style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                              <td className="py-3">
                                <div className="fw-semibold">{item.name}</div>
                                {isLow && <span className="text-danger x-small fw-bold">LOW STOCK ALERT</span>}
                              </td>
                              <td className="py-3 text-center">
                                <span className={isLow ? 'text-danger fw-bold' : ''}>{item.quantity} {item.unit}</span>
                              </td>
                              <td className="py-3 text-end">Rs. {item.price_per_unit}</td>
                              <td className="py-3 text-end">
                                <button className="btn btn-sm btn-outline-secondary" onClick={async () => {
                                  const amount = window.prompt(`Deduct how many ${item.unit}?`);
                                  if(amount) { try { await deductStock(item.id, Number(amount)); toast.success('Stock deducted'); } catch(e) { toast.error(e.message); } }
                                }}>Deduct</button>
                              </td>
                            </tr>
                          );
                        })}
                        {inventory.length === 0 && <tr><td colSpan={4} className="py-5 text-center text-muted">No items in inventory</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── PRODUCTS TAB ── */}
          <TabsContent value="products">
            <div className="d-flex flex-column gap-4">
              <div className="th-card-static p-4">
                <h5 className="font-playfair fw-semibold mb-3">{editingProductId ? t('admin.editProduct', 'Edit Product') : t('admin.addProduct', 'Add Product')}</h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <input id="admin-product-name" className="th-input" placeholder={t('admin.productName', 'Product name')} value={productDraft.name} onChange={e => setProductDraft(prev => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <input id="admin-product-price" className="th-input" placeholder={t('admin.price', 'Price')} type="number" value={productDraft.price || ''} onChange={e => setProductDraft(prev => ({ ...prev, price: Number(e.target.value) }))} />
                  </div>
                  <div className="col-md-6">
                    <select className="th-select" value={productDraft.category} onChange={e => setProductDraft(prev => ({ ...prev, category: e.target.value }))}>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>{category.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <select className="th-select" value={productDraft.wearType} onChange={e => setProductDraft(prev => ({ ...prev, wearType: e.target.value }))}>
                      <option value="traditional">Traditional</option>
                      <option value="western">Western</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <input id="admin-product-fabric" className="th-input" placeholder={t('admin.fabric', 'Fabric')} value={productDraft.fabric} onChange={e => setProductDraft(prev => ({ ...prev, fabric: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <input id="admin-product-image" className="th-input" placeholder={t('admin.imageUrl', 'Image URL (optional)')} value={productDraft.image} onChange={e => setProductDraft(prev => ({ ...prev, image: e.target.value }))} />
                  </div>
                  <div className="col-12">
                    <input id="admin-product-description" className="th-input" placeholder={t('admin.description', 'Description')} value={productDraft.description} onChange={e => setProductDraft(prev => ({ ...prev, description: e.target.value }))} />
                  </div>
                  <div className="col-12">
                    <input id="admin-product-colors" className="th-input" placeholder={t('admin.colorsCsv', 'Colors (comma separated)')} value={Array.isArray(productDraft.colors) ? productDraft.colors.join(', ') : productDraft.colors} onChange={e => setProductDraft(prev => ({ ...prev, colors: e.target.value }))} />
                  </div>
                  <div className="col-12">
                    <input id="admin-product-sizes" className="th-input" placeholder={t('admin.sizesCsv', 'Sizes (comma separated)')} value={Array.isArray(productDraft.sizes) ? productDraft.sizes.join(', ') : productDraft.sizes} onChange={e => setProductDraft(prev => ({ ...prev, sizes: e.target.value }))} />
                  </div>
                  <div className="col-12">
                    <input id="admin-product-modes" className="th-input" placeholder={t('admin.modesCsv', 'Modes e.g. ready-to-wear, custom-stitching, unstitched')} value={Array.isArray(productDraft.availableModes) ? productDraft.availableModes.join(', ') : productDraft.availableModes} onChange={e => setProductDraft(prev => ({ ...prev, availableModes: e.target.value }))} />
                  </div>
                  <div className="col-12 d-flex flex-wrap gap-2">
                    <button className="btn btn-accent flex-grow-1" onClick={submitProduct}>{editingProductId ? t('admin.updateProduct', 'Update Product') : t('admin.addProduct', 'Add Product')}</button>
                    {editingProductId && (
                      <button className="btn btn-outline-secondary" onClick={() => { setEditingProductId(null); setProductDraft(emptyProduct); }}>
                        {t('admin.cancelEdit', 'Cancel')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="th-card-static p-4">
                <h5 className="font-playfair fw-semibold mb-3">{t('admin.productsCount', 'Products')} ({products.length})</h5>
                <div className="d-flex flex-column gap-2">
                  {products.slice(0, 30).map(product => (
                    <div key={product.id} className="d-flex align-items-center justify-content-between rounded-3 border p-3">
                      <div>
                        <p className="fw-medium mb-0">{product.name}</p>
                        <p className="text-muted small mb-0">{product.fabric} • Rs. {product.price.toLocaleString()}</p>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={() => startEditProduct(product)}>
                          <Pencil size={12} /> {t('admin.edit', 'Edit')}
                        </button>
                        <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={async () => { try { await deleteProduct(product.id); toast.success('Product deleted'); if (editingProductId === product.id) { setEditingProductId(null); setProductDraft(emptyProduct); } } catch (error) { toast.error(error.message || 'Unable to delete'); } }}>
                          <Trash2 size={12} /> {t('admin.delete', 'Delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── ROLES TAB ── */}
          <TabsContent value="roles">
            <div className="d-flex flex-column gap-4">
              <div className="th-card-static p-4">
                <h5 className="font-playfair fw-semibold mb-3">{t('admin.addTeamMember', 'Add Team Member')}</h5>
                <div className="row g-3">
                  <div className="col-md-4">
                    <input id="admin-member-fullname" className="th-input" placeholder={t('admin.fullName', 'Full name')} value={memberDraft.fullName} onChange={e => setMemberDraft(prev => ({ ...prev, fullName: e.target.value }))} />
                  </div>
                  <div className="col-md-4">
                    <input id="admin-member-email" className="th-input" placeholder={t('admin.email', 'Email')} value={memberDraft.email} onChange={e => setMemberDraft(prev => ({ ...prev, email: e.target.value }))} />
                  </div>
                  <div className="col-md-4">
                    <select className="th-select" value={memberDraft.role} onChange={e => setMemberDraft(prev => ({ ...prev, role: e.target.value }))}>
                      <option value="customer">Customer</option>
                      <option value="admin">Admin</option>
                      <option value="delivery">Delivery</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <button className="btn btn-accent w-100" onClick={submitMember}>{t('admin.addMember', 'Add Member')}</button>
                  </div>
                </div>
              </div>

              <div className="th-card-static p-4">
                <h5 className="font-playfair fw-semibold mb-3">{t('admin.roleAssignment', 'Role Assignment')}</h5>
                <div className="d-flex flex-column gap-2">
                  {teamMembers.map(member => (
                    <div key={member.id} className="d-flex align-items-center justify-content-between rounded-3 border p-3">
                      <div>
                        <p className="fw-medium mb-0">{member.fullName}</p>
                        <p className="text-muted small mb-0">{member.email}</p>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <select className="th-select" style={{ width: 140 }} value={member.role}
                          onChange={async e => { try { await updateTeamMemberRole(member.id, e.target.value); } catch (error) { toast.error(error.message || 'Unable to update role'); } }}>
                          <option value="customer">Customer</option>
                          <option value="admin">Admin</option>
                          <option value="delivery">Delivery</option>
                        </select>
                        <button className="btn btn-outline-danger btn-sm p-2" onClick={async () => { if(window.confirm('Remove this member?')) { try { await deleteTeamMember(member.id); toast.success('Member removed'); } catch (error) { toast.error(error.message || 'Unable to remove'); } } }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
          {/* ── SETTINGS TAB ── */}
          <TabsContent value="settings">
            <div className="th-card-static p-4">
              <h5 className="font-playfair fw-semibold mb-4">Account Settings</h5>
              <div className="d-flex flex-column gap-3" style={{ maxWidth: 300 }}>
                <button 
                  className="btn btn-outline-accent d-flex align-items-center justify-content-center gap-2"
                  onClick={() => navigate('/change-password')}
                >
                  <KeyRound size={16} /> {t('change.title')}
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
