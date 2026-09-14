import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import { useStore } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Pencil, ShoppingBag, Trash2, Users, Package, TrendingUp, FileText, BookOpen, Download, Settings, KeyRound, Clock, Loader2, Eye, ChevronDown, ChevronUp, Calendar, CreditCard, Shield, Activity, UserCheck, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { categories } from '@/data/products';
import useScrollAnim from '@/hooks/useScrollAnim';
import { apiRequest } from '@/lib/api';

import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  category: 'pent-coat',
  wearType: 'western',
  image: '',
  availableModes: ['ready-to-wear', 'custom-stitching'],
  fabric: '',
  colors: ['Black', 'Navy'],
  sizes: ['M', 'L'],
  featured: false,
};

const AdminDashboard = () => {
  const { fullName, session, changePassword } = useAuth();
  const token = session?.access_token;
  const { t } = useLanguage();
  const ref = useScrollAnim();
  const navigate = useNavigate();
  const {
    products,
    orders,
    teamMembers,
    refreshTeamMembers,
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
    toggleSoldOut,
    toggleProductSoldOut,
    expenses,
    recordExpense,
    addKhataEntry,
    khataSummary,
    invoices,
    emailInvoice,
    markInvoicePaid,
    refundOrder,
  } = useStore();

  const [productDraft, setProductDraft] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);
  const [memberDraft, setMemberDraft] = useState({ fullName: '', email: '', role: 'customer' });
  const [invDraft, setInvDraft] = useState({ name: '', quantity: 0, price_per_unit: 0, unit: 'meters', threshold: 10 });
  const [expDraft, setExpDraft] = useState({ category: '', amount: 0, description: '' });
  const [khataDraft, setKhataDraft] = useState({ customer_id: '', type: 'payment', amount: 0, notes: '', order_id: '' });

  const [expensePage, setExpensePage] = useState(1);
  const [expenseStart, setExpenseStart] = useState('');
  const [expenseEnd, setExpenseEnd] = useState('');
  
  const EXPENSE_LIMIT = 5;
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = new Date(exp.expense_date);
      if (expenseStart && expDate < new Date(expenseStart)) return false;
      if (expenseEnd && expDate > new Date(expenseEnd + 'T23:59:59')) return false;
      return true;
    });
  }, [expenses, expenseStart, expenseEnd]);
  const paginatedExpenses = filteredExpenses.slice((expensePage - 1) * EXPENSE_LIMIT, expensePage * EXPENSE_LIMIT);
  const totalExpensePages = Math.max(1, Math.ceil(filteredExpenses.length / EXPENSE_LIMIT));

  const exportKhataCsv = () => {
    const data = orders.map(o => ({
      'Order ID': o.id,
      'Customer Name': o.customerName,
      'Total Amount': o.totalAmount,
      'Amount Paid': o.amountPaid,
      'Balance': o.totalAmount - o.amountPaid
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Khata_Settlement_Status.csv';
    link.click();
  };

  const exportKhataPdf = () => {
    const doc = new jsPDF();
    doc.text('Khata Settlement Status', 14, 15);
    const tableData = orders.map(o => [
      o.id,
      o.customerName,
      `Rs. ${o.totalAmount.toLocaleString()}`,
      `Rs. ${o.amountPaid.toLocaleString()}`,
      `Rs. ${(o.totalAmount - o.amountPaid).toLocaleString()}`
    ]);
    doc.autoTable({
      head: [['Order ID', 'Customer Name', 'Total', 'Paid', 'Balance']],
      body: tableData,
      startY: 20,
    });
    doc.save('Khata_Settlement_Status.pdf');
  };

  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  // ── Order detail expand ──
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // ── Audit log state ──
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // ── Customer state & data computed ──
  const [customerSearch, setCustomerSearch] = useState('');
  const [refreshingCustomers, setRefreshingCustomers] = useState(false);

  const handleRefreshCustomers = async () => {
    setRefreshingCustomers(true);
    try {
      if (refreshTeamMembers) {
        await refreshTeamMembers();
        toast.success('Customer list refreshed');
      }
    } catch (e) {
      toast.error('Failed to refresh customers');
    } finally {
      setRefreshingCustomers(false);
    }
  };

  const customerData = useMemo(() => {
    const customers = teamMembers.filter(m => (m.role || '').toLowerCase() === 'customer');
    return customers.map(c => {
      const custOrders = orders.filter(o => 
        o.customer_id === c.id || 
        (c.email && o.customerEmail && o.customerEmail.toLowerCase() === c.email.toLowerCase())
      );
      const totalSpent = custOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const outstanding = custOrders.reduce((s, o) => s + Math.max(0, (o.totalAmount || 0) - (o.amountPaid || 0)), 0);
      return { ...c, orderCount: custOrders.length, totalSpent, outstanding };
    }).sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return b.totalSpent - a.totalSpent;
    });
  }, [teamMembers, orders]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customerData;
    const q = customerSearch.toLowerCase();
    return customerData.filter(c => 
      (c.fullName && c.fullName.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.id && String(c.id).toLowerCase().includes(q))
    );
  }, [customerData, customerSearch]);

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const logs = await apiRequest('/api/admin/audit-logs?limit=100');
      setAuditLogs(logs);
    } catch (e) {
      toast.error('Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  // ── Appointment state ──
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentFilter, setAppointmentFilter] = useState('all'); // all | pending | approved | rejected | completed
  const [appointmentSearch, setAppointmentSearch] = useState('');

  const fetchAppointments = async () => {
    if (!token) return;
    setAppointmentsLoading(true);
    try {
      const data = await apiRequest('/api/appointments', { token });
      setAppointments(data || []);
    } catch (e) {
      console.error('Failed to load appointments:', e);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    if (refreshTeamMembers) {
      refreshTeamMembers();
    }
  }, [token]);

  const updateAppointmentStatus = async (id, status, adminNotes = '') => {
    try {
      await apiRequest(`/api/appointments/${id}/status`, {
        method: 'PATCH',
        token,
        body: { status, admin_notes: adminNotes },
      });
      toast.success(`Appointment marked as ${status}!`);
      fetchAppointments();
    } catch (err) {
      toast.error(err.message || 'Failed to update appointment');
    }
  };

  const deleteAppointment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this appointment request?')) return;
    try {
      await apiRequest(`/api/appointments/${id}`, {
        method: 'DELETE',
        token,
      });
      toast.success('Appointment deleted');
      fetchAppointments();
    } catch (err) {
      toast.error(err.message || 'Failed to delete appointment');
    }
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      const matchesFilter = appointmentFilter === 'all' || a.status === appointmentFilter;
      const q = appointmentSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        a.customer_name?.toLowerCase().includes(q) ||
        a.customer_email?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q) ||
        a.appointment_date?.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [appointments, appointmentFilter, appointmentSearch]);

  const pendingAppointmentsCount = useMemo(() => {
    return appointments.filter(a => a.status === 'pending').length;
  }, [appointments]);

  // ── Orders tab filters ──
  const [orderFilter, setOrderFilter] = useState('all'); // all | assigned | unassigned
  const [orderSearch, setOrderSearch] = useState('');

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (orderFilter === 'assigned') {
      result = result.filter(o => o.assignedTo);
    } else if (orderFilter === 'unassigned') {
      result = result.filter(o => !o.assignedTo);
    }
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      result = result.filter(o =>
        o.id?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.customerEmail?.toLowerCase().includes(q) ||
        o.status?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, orderFilter, orderSearch]);



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

        <Tabs defaultValue="orders" className="mt-4">
          <TabsList>
            <TabsTrigger value="orders">{t('admin.orders', 'Orders')}</TabsTrigger>
            <TabsTrigger value="customers"><Users size={14} className="me-1" /> {t('admin.customers', 'Customers')}</TabsTrigger>
            <TabsTrigger value="appointments">
              <Calendar size={14} className="me-1" />
              {t('admin.appointments', 'Appointments')}
              {pendingAppointmentsCount > 0 && (
                <span className="badge rounded-pill bg-warning text-dark ms-1" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                  {pendingAppointmentsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="khata"><BookOpen size={14} className="me-1" /> {t('admin.khataTab')}</TabsTrigger>
            <TabsTrigger value="invoices"><FileText size={14} className="me-1" /> {t('admin.invoicesTab')}</TabsTrigger>
            <TabsTrigger value="inventory"><Package size={14} className="me-1" /> {t('admin.inventoryTab')}</TabsTrigger>
            <TabsTrigger value="products">{t('admin.products', 'Products')}</TabsTrigger>
            <TabsTrigger value="roles">{t('admin.roles', 'Team')}</TabsTrigger>
            <TabsTrigger value="audit"><Shield size={14} className="me-1" /> {t('admin.audit', 'Audit')}</TabsTrigger>
            <TabsTrigger value="settings"><Settings size={14} className="me-1" /> {t('admin.settingsTab')}</TabsTrigger>
          </TabsList>



          {/* ── ORDERS TAB ── */}
          <TabsContent value="orders">
            <div className="th-card-static p-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <h5 className="font-playfair fw-semibold mb-0">{t('admin.orderManagement', 'Order Management')}</h5>
                <div className="d-flex align-items-center gap-2">
                  <span className="text-muted small">{filteredOrders.length} of {orders.length}</span>
                </div>
              </div>

              {/* Filter tabs + Search */}
              <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
                <div className="btn-group" role="group">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'assigned', label: 'Assigned' },
                    { key: 'unassigned', label: 'Unassigned' },
                  ].map(f => (
                    <button
                      key={f.key}
                      type="button"
                      className={`btn btn-sm ${orderFilter === f.key ? 'btn-dark' : 'btn-outline-secondary'}`}
                      onClick={() => setOrderFilter(f.key)}
                    >
                      {f.label}
                      {f.key === 'all' && ` (${orders.length})`}
                      {f.key === 'assigned' && ` (${orders.filter(o => o.assignedTo).length})`}
                      {f.key === 'unassigned' && ` (${orders.filter(o => !o.assignedTo).length})`}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="th-input"
                  placeholder="Search by order #, customer name, email, status..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  style={{ maxWidth: 320, flex: 1 }}
                />
                {(orderFilter !== 'all' || orderSearch) && (
                  <Button variant="ghost" size="sm" onClick={() => { setOrderFilter('all'); setOrderSearch(''); }}>
                    Reset
                  </Button>
                )}
              </div>

              <div className="d-flex flex-column gap-3">
                {filteredOrders.length === 0 && (
                  <p className="py-5 text-center text-muted">
                    {orders.length === 0 ? 'No orders yet' : 'No orders match the current filter'}
                  </p>
                )}
                {filteredOrders.map(order => {
                  const sc = STATUS_COLORS[order.status] || { bg: '#f1f3f5', color: '#6c757d' };
                  const assignedRider = teamMembers.find(m => m.id === order.assignedTo);
                  return (
                    <div key={order.id} className="rounded-3 border p-4">
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <p className="fw-semibold mb-0">{order.id} • {order.customerName}</p>
                            {/* Payment method badge */}
                            {order.payment?.method && (
                              <span className="th-badge th-badge-soft" style={{ fontSize: '0.65rem' }}>
                                <CreditCard size={10} className="me-1" />
                                {order.payment.method.toUpperCase()}
                                {order.payment.status === 'completed' && ' ✓'}
                              </span>
                            )}
                          </div>
                          <p className="text-muted small mb-0">
                            {order.customerEmail} • Rs. {order.totalAmount.toLocaleString()}
                            {order.createdAt && (
                              <span className="ms-2">
                                <Calendar size={10} className="me-1" />
                                {new Date(order.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                          {order.deliveryAddress && (
                            <p className="text-muted small mb-0">{order.deliveryAddress}, {order.deliveryCity} • {order.deliveryPhone}</p>
                          )}
                          {assignedRider && (
                            <p className="small mb-0 mt-1" style={{ color: '#0891b2' }}>
                              Assigned to: {assignedRider.fullName || assignedRider.email}
                            </p>
                          )}
                        </div>
                        <span className="th-badge" style={{ backgroundColor: sc.bg, color: sc.color }}>
                          {order.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Expandable items */}
                      {order.items?.length > 0 && (
                        <div className="mb-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 text-decoration-none small d-flex align-items-center gap-1"
                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                          >
                            {expandedOrderId === order.id
                              ? <><ChevronUp size={14} /> Hide items</>
                              : <><ChevronDown size={14} /> {order.items.length} item(s)</>
                            }
                          </Button>
                          {expandedOrderId === order.id && (
                            <div className="border rounded-3 p-2 mt-2" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                              {order.items.map((item, idx) => (
                                <div key={idx} className="d-flex justify-content-between small py-1">
                                  <span className="text-truncate me-2">
                                    {item.productName} × {item.quantity}
                                    {item.color ? ` · ${item.color}` : ''}
                                    {item.size ? ` · ${item.size}` : ''}
                                    {item.garmentCategory ? ` · ${item.garmentCategory}` : ''}
                                  </span>
                                  <span className="text-muted flex-shrink-0">
                                    Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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
                              <option key={m.id} value={m.id}>{m.fullName || m.email}</option>
                            ))}
                          </select>
                        </div>
                        {/* Generate Invoice */}
                        <div className="col-md-3">
                          <Button variant="outline" className="w-100" onClick={() => downloadInvoice(order.id)}>
                            <FileText size={16} /> Invoice
                          </Button>
                        </div>
                        {/* Refund Order */}
                        {order.payment?.method === 'card' && order.payment?.status === 'completed' && (
                          <div className="col-md-3">
                            <Button 
                              className="w-100" 
                              style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                              onClick={async () => { if(window.confirm('Issue a full refund for this order?')) { try { await refundOrder(order.id); toast.success('Refund issued successfully'); } catch (error) { toast.error(error.message || 'Unable to issue refund'); } } }}>
                              Refund
                            </Button>
                          </div>
                        )}
                        {/* Delete Order */}
                        <div className="col-md-3">
                          <Button variant="destructive" className="w-100" onClick={async () => { if(window.confirm('Delete this order?')) { try { await deleteOrder(order.id); toast.success('Order deleted'); } catch (error) { toast.error(error.message || 'Unable to delete'); } } }}>
                            <Trash2 size={16} /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ── CUSTOMERS TAB ── */}
          <TabsContent value="customers">
            <div className="th-card-static p-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                  <h5 className="font-playfair fw-semibold mb-1">{t('admin.customers', 'Customer Management')}</h5>
                  <p className="text-muted small mb-0">Total registered customers: <strong>{customerData.length}</strong></p>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className="input-group input-group-sm" style={{ minWidth: '220px', maxWidth: '300px' }}>
                    <span className="input-group-text bg-light border-end-0">
                      <Search size={14} className="text-muted" />
                    </span>
                    <input
                      type="text"
                      className="form-control bg-light border-start-0 ps-0"
                      placeholder="Search by name, email..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                    {customerSearch && (
                      <button
                        className="btn btn-sm bg-light border-start-0 text-muted"
                        type="button"
                        onClick={() => setCustomerSearch('')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshCustomers}
                    disabled={refreshingCustomers}
                    className="d-flex align-items-center gap-1.5"
                  >
                    <RefreshCw size={14} className={refreshingCustomers ? 'animate-spin' : ''} />
                    <span>{refreshingCustomers ? 'Refreshing...' : 'Refresh'}</span>
                  </Button>
                </div>
              </div>

              {filteredCustomers.length === 0 ? (
                <div className="py-5 text-center text-muted">
                  <p className="mb-2">
                    {customerSearch ? `No customers found matching "${customerSearch}"` : 'No registered customers found yet.'}
                  </p>
                  <Button variant="outline" size="sm" onClick={handleRefreshCustomers} disabled={refreshingCustomers}>
                    <RefreshCw size={14} className={`me-1.5 ${refreshingCustomers ? 'animate-spin' : ''}`} />
                    Refresh Customer List
                  </Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-borderless align-middle small mb-0">
                    <thead>
                      <tr className="border-bottom">
                        <th className="text-muted pb-2">Customer</th>
                        <th className="text-muted pb-2 text-center">Email Status</th>
                        <th className="text-muted pb-2 text-center">Registered Date</th>
                        <th className="text-muted pb-2 text-center">Orders</th>
                        <th className="text-muted pb-2 text-end">Total Spent</th>
                        <th className="text-muted pb-2 text-end">Outstanding</th>
                        <th className="text-muted pb-2 text-center">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map(c => {
                        const regDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-PK', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : '—';

                        return (
                          <tr key={c.id} className="border-bottom" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                            <td className="py-3">
                              <div className="fw-semibold text-dark">{c.fullName || '—'}</div>
                              <div className="text-muted x-small">{c.email}</div>
                              {c.id && <div className="text-muted" style={{ fontSize: '10px' }}>ID: {c.id}</div>}
                            </td>
                            <td className="py-3 text-center">
                              {c.emailVerified ? (
                                <span className="badge bg-success bg-opacity-10 text-success fw-normal px-2 py-1 rounded-pill">
                                  Verified
                                </span>
                              ) : (
                                <span className="badge bg-warning bg-opacity-10 text-warning fw-normal px-2 py-1 rounded-pill">
                                  Unverified
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-center text-muted">
                              {regDate}
                            </td>
                            <td className="py-3 text-center">
                              <span className="th-badge th-badge-soft">{c.orderCount}</span>
                            </td>
                            <td className="py-3 text-end fw-medium">
                              Rs. {c.totalSpent.toLocaleString()}
                            </td>
                            <td className="py-3 text-end fw-bold" style={{ color: c.outstanding > 0 ? '#d97706' : '#16a34a' }}>
                              Rs. {c.outstanding.toLocaleString()}
                            </td>
                            <td className="py-3 text-center">
                              {c.outstanding > 0 ? (
                                <span className="th-badge bg-warning bg-opacity-10 text-warning">Pending</span>
                              ) : c.totalSpent > 0 ? (
                                <span className="th-badge bg-success bg-opacity-10 text-success">Paid</span>
                              ) : (
                                <span className="th-badge bg-secondary bg-opacity-10 text-secondary">New</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
                      {teamMembers
                        .filter(m => m.role === 'customer')
                        .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {m.fullName ? `${m.fullName} (${m.email})` : m.email}
                          </option>
                        ))}
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
                    <Button className="w-100" onClick={async () => {
                      if(!khataDraft.customer_id || !khataDraft.amount) return toast.error('Fill required fields');
                      try { await addKhataEntry({ ...khataDraft, order_id: khataDraft.order_id || null }); setKhataDraft({ customer_id: '', type: 'payment', amount: 0, notes: '', order_id: '' }); toast.success('Entry recorded'); } catch(e) { toast.error(e.message); }
                    }}>Record Entry</Button>
                  </div>
                </div>

                <div className="th-card-static p-4">
                  <h6 className="fw-bold mb-3">Record Expense</h6>
                  <div className="d-flex flex-column gap-3">
                    <input className="th-input" placeholder="Category (e.g. Rent)" value={expDraft.category} onChange={e => setExpDraft(prev => ({ ...prev, category: e.target.value }))} />
                    <input className="th-input" type="number" placeholder="Amount" value={expDraft.amount || ''} onChange={e => setExpDraft(prev => ({ ...prev, amount: Number(e.target.value) }))} />
                    <input className="th-input" placeholder="Description" value={expDraft.description} onChange={e => setExpDraft(prev => ({ ...prev, description: e.target.value }))} />
                    <Button variant="destructive" className="w-100" onClick={async () => {
                      if(!expDraft.category || !expDraft.amount) return toast.error('Fill required fields');
                      try { await recordExpense(expDraft); setExpDraft({ category: '', amount: 0, description: '' }); toast.success('Expense recorded'); } catch(e) { toast.error(e.message); }
                    }}>Add Expense</Button>
                  </div>
                </div>
              </div>

              {/* Lists */}
              <div className="col-lg-8">
                <div className="th-card-static p-4 mb-4">
                  <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-3">
                    <h6 className="fw-bold mb-0">Expenses</h6>
                    <div className="d-flex gap-2">
                      <input type="date" className="th-input form-control-sm" style={{ width: 130 }} value={expenseStart} onChange={e => { setExpenseStart(e.target.value); setExpensePage(1); }} title="Start Date" />
                      <input type="date" className="th-input form-control-sm" style={{ width: 130 }} value={expenseEnd} onChange={e => { setExpenseEnd(e.target.value); setExpensePage(1); }} title="End Date" />
                    </div>
                  </div>
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
                        {paginatedExpenses.length === 0 ? (
                          <tr><td colSpan="3" className="text-center text-muted py-3">No expenses found.</td></tr>
                        ) : paginatedExpenses.map(exp => (
                          <tr key={exp.id} className="border-bottom" style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                            <td className="py-2">{exp.category} <div className="text-muted x-small">{exp.description}</div></td>
                            <td className="py-2 text-end fw-medium text-danger">Rs. {exp.amount.toLocaleString()}</td>
                            <td className="py-2 text-end text-muted">{new Date(exp.expense_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <span className="small text-muted">Page {expensePage} of {totalExpensePages}</span>
                    <div className="d-flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setExpensePage(p => Math.max(1, p - 1))} disabled={expensePage === 1}>Prev</Button>
                      <Button variant="outline" size="sm" onClick={() => setExpensePage(p => Math.min(totalExpensePages, p + 1))} disabled={expensePage === totalExpensePages}>Next</Button>
                    </div>
                  </div>
                </div>

                <div className="th-card-static p-4">
                  <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-3">
                    <h6 className="fw-bold mb-0">Order Settlement Status</h6>
                    <div className="d-flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportKhataCsv}>CSV</Button>
                      <Button variant="outline" size="sm" onClick={exportKhataPdf}>PDF</Button>
                    </div>
                  </div>
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
                            <Button variant="outline" size="sm" onClick={() => downloadInvoice(inv.order_id)}>
                              Preview PDF
                            </Button>
                            <Button variant="outline" size="sm" onClick={async () => {
                              try {
                                await emailInvoice(inv.invoice_number);
                                toast.success('Email receipt sent successfully');
                              } catch(e) { toast.error('Failed to send email'); }
                            }}>
                              Email Receipt
                            </Button>
                            {inv.status !== 'paid' && (
                              <Button size="sm" onClick={async () => {
                                if(window.confirm('Mark this invoice as manually paid (e.g. COD)?')) {
                                  try {
                                    await markInvoicePaid(inv.invoice_number);
                                    toast.success('Invoice marked as paid');
                                  } catch(e) { toast.error('Failed to mark paid'); }
                                }
                              }}>
                                Mark Paid
                              </Button>
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
                  <h5 className="font-playfair fw-semibold mb-3">{t('admin.addStock')}</h5>
                  <div className="d-flex flex-column gap-3">
                    <input className="th-input" placeholder={t('admin.itemNamePlaceholder')} value={invDraft.name} onChange={e => setInvDraft(prev => ({ ...prev, name: e.target.value }))} />
                    <div className="row g-2">
                      <div className="col-6">
                        <input className="th-input" type="number" placeholder={t('admin.quantity')} value={invDraft.quantity || ''} onChange={e => setInvDraft(prev => ({ ...prev, quantity: Number(e.target.value) }))} />
                      </div>
                      <div className="col-6">
                        <input className="th-input" placeholder={t('admin.unit')} value={invDraft.unit} onChange={e => setInvDraft(prev => ({ ...prev, unit: e.target.value }))} />
                      </div>
                    </div>
                    <input className="th-input" type="number" placeholder={t('admin.pricePerUnitPlaceholder')} value={invDraft.price_per_unit || ''} onChange={e => setInvDraft(prev => ({ ...prev, price_per_unit: Number(e.target.value) }))} />
                    <input className="th-input" type="number" placeholder={t('admin.lowStockThreshold')} value={invDraft.threshold || ''} onChange={e => setInvDraft(prev => ({ ...prev, threshold: Number(e.target.value) }))} />
                    <Button className="w-100" onClick={async () => {
                      if(!invDraft.name || !invDraft.quantity) return toast.error(t('admin.fillRequired'));
                      try { await addInventoryItem(invDraft); setInvDraft({ name: '', quantity: 0, price_per_unit: 0, unit: 'meters', threshold: 10 }); toast.success(t('admin.itemAdded')); } catch(e) { toast.error(e.message); }
                    }}>{t('admin.addToInventory')}</Button>
                  </div>
                </div>
              </div>

              <div className="col-lg-8">
                <div className="th-card-static p-4">
                  <h5 className="font-playfair fw-semibold mb-3">{t('admin.currentInventory')}</h5>
                  <div className="table-responsive">
                    <table className="table table-borderless small mb-0">
                      <thead>
                        <tr className="border-bottom">
                          <th className="text-muted pb-2">{t('admin.itemName')}</th>
                          <th className="text-muted pb-2 text-center">{t('admin.stockQty')}</th>
                          <th className="text-muted pb-2 text-end">{t('admin.pricePerUnit')}</th>
                          <th className="text-muted pb-2 text-center">{t('admin.status')}</th>
                          <th className="text-muted pb-2 text-end">{t('admin.action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map(item => {
                          const isLow = !item.is_sold_out && item.quantity <= item.threshold;
                          return (
                            <tr key={item.id} className="border-bottom" style={{ borderColor: 'rgba(0,0,0,0.03)', opacity: item.is_sold_out ? 0.6 : 1 }}>
                              <td className="py-3">
                                <div className="fw-semibold">{item.name}</div>
                                {isLow && <span className="text-danger x-small fw-bold">{t('admin.lowStockAlert')}</span>}
                                {item.is_sold_out && <span className="x-small fw-bold" style={{ color: '#dc2626' }}>{t('admin.soldOutBadge')}</span>}
                              </td>
                              <td className="py-3 text-center">
                                <span className={isLow ? 'text-danger fw-bold' : ''}>{item.is_sold_out ? '-' : `${item.quantity} ${item.unit}`}</span>
                              </td>
                              <td className="py-3 text-end">Rs. {item.price_per_unit}</td>
                              <td className="py-3 text-center">
                                <Button
                                  variant={item.is_sold_out ? 'outline' : 'default'}
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const updated = await toggleSoldOut(item.id);
                                      toast.success(updated.is_sold_out ? t('admin.markedSoldOut') : t('admin.restocked'));
                                    } catch(e) { toast.error(e.message); }
                                  }}
                                >
                                  {item.is_sold_out ? t('admin.restock') : t('admin.soldOut')}
                                </Button>
                              </td>
                              <td className="py-3 text-end">
                                <Button variant="outline" size="sm" disabled={item.is_sold_out} onClick={async () => {
                                  const amount = window.prompt(`${t('admin.deduct')} ${item.unit}?`);
                                  if(amount) { try { await deductStock(item.id, Number(amount)); toast.success(t('admin.stockDeducted')); } catch(e) { toast.error(e.message); } }
                                }}>{t('admin.deduct')}</Button>
                              </td>
                            </tr>
                          );
                        })}
                        {inventory.length === 0 && <tr><td colSpan={5} className="py-5 text-center text-muted">{t('admin.noItems')}</td></tr>}
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
                    <Button className="flex-grow-1" onClick={submitProduct}>{editingProductId ? t('admin.updateProduct', 'Update Product') : t('admin.addProduct', 'Add Product')}</Button>
                    {editingProductId && (
                      <Button variant="outline" onClick={() => { setEditingProductId(null); setProductDraft(emptyProduct); }}>
                        {t('admin.cancelEdit', 'Cancel')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="th-card-static p-4">
                <h5 className="font-playfair fw-semibold mb-3">{t('admin.productsCount', 'Products')} ({products.length})</h5>
                <div className="d-flex flex-column gap-2">
                  {products.slice(0, 30).map(product => (
                    <div key={product.id} className="d-flex align-items-center justify-content-between rounded-3 border p-3" style={{ opacity: product.isSoldOut ? 0.6 : 1 }}>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <p className="fw-medium mb-0">{product.name}</p>
                          {product.isSoldOut && <span className="x-small fw-bold" style={{ color: '#dc2626' }}>SOLD OUT</span>}
                        </div>
                        <p className="text-muted small mb-0">{product.fabric} • Rs. {product.price.toLocaleString()}</p>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <Button variant={product.isSoldOut ? 'outline' : 'default'} size="sm" onClick={async () => {
                          try {
                            const updated = await toggleProductSoldOut(product);
                            toast.success(updated.isSoldOut ? 'Product marked as Sold Out' : 'Product restocked');
                          } catch (e) { toast.error(e.message); }
                        }}>
                          {product.isSoldOut ? 'Restock' : 'Sold Out'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => startEditProduct(product)}>
                          <Pencil size={12} /> {t('admin.edit', 'Edit')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={async () => { try { await deleteProduct(product.id); toast.success('Product deleted'); if (editingProductId === product.id) { setEditingProductId(null); setProductDraft(emptyProduct); } } catch (error) { toast.error(error.message || 'Unable to delete'); } }}>
                          <Trash2 size={12} /> {t('admin.delete', 'Delete')}
                        </Button>
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
                    <Button className="w-100" onClick={submitMember}>{t('admin.addMember', 'Add Member')}</Button>
                  </div>
                </div>
              </div>

              <div className="th-card-static p-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="font-playfair fw-semibold mb-0">{t('admin.roleAssignment', 'Role Assignment')} ({teamMembers.length})</h5>
                  <Button variant="outline" size="sm" onClick={handleRefreshCustomers} disabled={refreshingCustomers}>
                    <RefreshCw size={14} className={`me-1.5 ${refreshingCustomers ? 'anim-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                {teamMembers.length === 0 ? (
                  <p className="py-4 text-center text-muted mb-0">No team members loaded yet. Click Refresh or add a member above.</p>
                ) : (
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
                        <Button variant="destructive" size="sm" onClick={async () => { if(window.confirm('Remove this member?')) { try { await deleteTeamMember(member.id); toast.success('Member removed'); } catch (error) { toast.error(error.message || 'Unable to remove'); } } }}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── APPOINTMENTS TAB ── */}
          <TabsContent value="appointments">
            <div className="th-card-static p-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                  <h5 className="font-playfair fw-semibold mb-1 d-flex align-items-center gap-2">
                    <Calendar className="text-accent" size={20} />
                    {t('admin.appointments.title', 'Customer Measurement Appointments')}
                  </h5>
                  <p className="text-muted small mb-0">
                    {t('admin.appointments.desc', 'Review, approve, or decline customer appointment requests for in-person measurements.')}
                  </p>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="text-muted small">
                    {filteredAppointments.length} of {appointments.length}
                  </span>
                  <Button variant="outline" size="sm" onClick={fetchAppointments} disabled={appointmentsLoading}>
                    {appointmentsLoading ? <Loader2 size={14} className="anim-spin me-1" /> : null}
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Filter tabs + Search */}
              <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
                <div className="btn-group" role="group">
                  {[
                    { key: 'all', label: 'All', count: appointments.length },
                    { key: 'pending', label: 'Pending', count: appointments.filter(a => a.status === 'pending').length },
                    { key: 'approved', label: 'Approved', count: appointments.filter(a => a.status === 'approved').length },
                    { key: 'rejected', label: 'Declined', count: appointments.filter(a => a.status === 'rejected').length },
                    { key: 'completed', label: 'Completed', count: appointments.filter(a => a.status === 'completed').length },
                  ].map(f => (
                    <button
                      key={f.key}
                      type="button"
                      className={`btn btn-sm ${appointmentFilter === f.key ? 'btn-dark' : 'btn-outline-secondary'}`}
                      onClick={() => setAppointmentFilter(f.key)}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="th-input"
                  placeholder="Search by customer, email, phone, date..."
                  value={appointmentSearch}
                  onChange={e => setAppointmentSearch(e.target.value)}
                  style={{ maxWidth: 320, flex: 1 }}
                />
                {(appointmentFilter !== 'all' || appointmentSearch) && (
                  <Button variant="ghost" size="sm" onClick={() => { setAppointmentFilter('all'); setAppointmentSearch(''); }}>
                    Reset
                  </Button>
                )}
              </div>

              {/* Table of Appointments */}
              {appointmentsLoading ? (
                <div className="text-center py-5">
                  <Loader2 className="anim-spin text-accent mb-2" size={32} />
                  <p className="text-muted small mb-0">Loading appointments...</p>
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-5 border rounded-3 text-muted">
                  <Calendar size={36} className="mb-2 opacity-50 text-accent" />
                  <p className="mb-0">No appointments found matching your filter.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Customer</th>
                        <th>Preferred Date & Time</th>
                        <th>Phone</th>
                        <th>Customer Notes</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.map(appt => {
                        const statusColors = {
                          pending: { bg: 'rgba(234,179,8,0.12)', color: '#ca8a04', text: 'Pending Approval' },
                          approved: { bg: 'rgba(34,197,94,0.12)', color: '#16a34a', text: 'Approved' },
                          rejected: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', text: 'Declined' },
                          completed: { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', text: 'Completed' },
                        };
                        const sc = statusColors[appt.status] || statusColors.pending;

                        return (
                          <tr key={appt.id}>
                            <td>
                              <div className="fw-semibold">{appt.customer_name}</div>
                              <div className="text-muted small">{appt.customer_email}</div>
                            </td>
                            <td>
                              <div className="fw-medium text-dark">{appt.appointment_date}</div>
                              <div className="text-muted small">{appt.time_slot}</div>
                            </td>
                            <td>
                              <span className="font-monospace small">{appt.phone}</span>
                            </td>
                            <td style={{ maxWidth: 220 }}>
                              <div className="small text-truncate" title={appt.notes || ''}>
                                {appt.notes || <span className="text-muted italic">—</span>}
                              </div>
                              {appt.admin_notes && (
                                <div className="text-muted small fst-italic">
                                  Admin: {appt.admin_notes}
                                </div>
                              )}
                            </td>
                            <td>
                              <span
                                className="badge px-2 py-1 rounded-pill"
                                style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}33` }}
                              >
                                {sc.text}
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="d-inline-flex align-items-center gap-1">
                                {appt.status === 'pending' && (
                                  <>
                                    <button
                                      className="btn btn-sm btn-success text-white py-1 px-2"
                                      onClick={() => updateAppointmentStatus(appt.id, 'approved')}
                                      title="Approve Appointment"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-danger py-1 px-2"
                                      onClick={() => {
                                        const reason = window.prompt('Reason for declining (optional):');
                                        if (reason !== null) updateAppointmentStatus(appt.id, 'rejected', reason);
                                      }}
                                      title="Decline Appointment"
                                    >
                                      Decline
                                    </button>
                                  </>
                                )}
                                {appt.status === 'approved' && (
                                  <>
                                    <button
                                      className="btn btn-sm btn-outline-primary py-1 px-2"
                                      onClick={() => updateAppointmentStatus(appt.id, 'completed')}
                                      title="Mark Completed"
                                    >
                                      Complete
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-secondary py-1 px-2"
                                      onClick={() => updateAppointmentStatus(appt.id, 'rejected')}
                                      title="Cancel Approval"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted p-1"
                                  onClick={() => deleteAppointment(appt.id)}
                                  title="Delete Record"
                                >
                                  <Trash2 size={15} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── SETTINGS TAB ── */}
          <TabsContent value="settings">
            <div className="th-card-static p-4">
              <h5 className="font-playfair fw-semibold mb-4">{t('admin.accountSettings')}</h5>
              <form
                className="d-flex flex-column gap-3"
                style={{ maxWidth: 360 }}
                onSubmit={async e => {
                  e.preventDefault();
                  if (pwdForm.newPwd !== pwdForm.confirm) {
                    toast.error(t('forgot.mismatch'));
                    return;
                  }
                  setPwdLoading(true);
                  const { error } = await changePassword(pwdForm.current, pwdForm.newPwd);
                  if (error) toast.error(error.message);
                  else {
                    toast.success(t('admin.passwordUpdated'));
                    setPwdForm({ current: '', newPwd: '', confirm: '' });
                  }
                  setPwdLoading(false);
                }}
              >
                <div>
                  <label className="th-label">{t('admin.currentPassword')}</label>
                  <input
                    type="password"
                    className="th-input"
                    value={pwdForm.current}
                    onChange={e => setPwdForm(prev => ({ ...prev, current: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="th-label">{t('admin.newPassword')}</label>
                  <input
                    type="password"
                    className="th-input"
                    value={pwdForm.newPwd}
                    onChange={e => setPwdForm(prev => ({ ...prev, newPwd: e.target.value }))}
                    required
                    minLength={12}
                  />
                </div>
                <div>
                  <label className="th-label">{t('admin.confirmNewPassword')}</label>
                  <input
                    type="password"
                    className="th-input"
                    value={pwdForm.confirm}
                    onChange={e => setPwdForm(prev => ({ ...prev, confirm: e.target.value }))}
                    required
                    minLength={12}
                  />
                </div>
                <Button type="submit" disabled={pwdLoading}>
                  {pwdLoading && <Loader2 size={16} className="anim-spin me-2" />}
                  {t('admin.changePasswordBtn')}
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* ── AUDIT LOG TAB ── */}
          <TabsContent value="audit">
            <div className="th-card-static p-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <h5 className="font-playfair fw-semibold mb-0">{t('admin.audit', 'Audit Log')}</h5>
                <Button variant="outline" size="sm" onClick={fetchAuditLogs} disabled={auditLoading}>
                  {auditLoading ? <Loader2 size={14} className="anim-spin me-1" /> : <Activity size={14} className="me-1" />}
                  Refresh
                </Button>
              </div>

              {auditLogs.length === 0 && !auditLoading && (
                <div className="text-center py-5">
                  <Shield size={48} className="text-muted mb-3" style={{ opacity: 0.3 }} />
                  <p className="text-muted mb-2">No audit logs loaded</p>
                  <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
                    <Activity size={14} className="me-1" /> Load Audit Logs
                  </Button>
                </div>
              )}

              {auditLoading && (
                <div className="d-flex flex-column align-items-center py-5">
                  <Loader2 size={32} className="anim-spin text-accent mb-3" />
                  <p className="text-muted">Loading audit logs...</p>
                </div>
              )}

              {auditLogs.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-borderless small mb-0">
                    <thead>
                      <tr className="border-bottom">
                        <th className="text-muted pb-2">Time</th>
                        <th className="text-muted pb-2">Action</th>
                        <th className="text-muted pb-2">Actor</th>
                        <th className="text-muted pb-2">Resource</th>
                        <th className="text-muted pb-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id} className="border-bottom" style={{ borderColor: 'rgba(0,0,0,0.03)' }}>
                          <td className="py-2 text-muted x-small" style={{ whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-2">
                            <span className="th-badge th-badge-soft" style={{ fontSize: '0.65rem' }}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2 text-muted">{log.actor_email || 'System'}</td>
                          <td className="py-2 text-muted">{log.resource_type} {log.resource_id && <span className="font-monospace">{log.resource_id}</span>}</td>
                          <td className="py-2 text-muted x-small" style={{ maxWidth: 300 }}>
                            {log.details ? JSON.stringify(log.details).slice(0, 80) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
