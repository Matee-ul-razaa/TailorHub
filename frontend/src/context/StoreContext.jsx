import React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, getAuthToken } from '@/lib/api';
import { products as seedProducts } from '@/data/products';
import { useAuth } from '@/context/AuthContext';

const ORDER_PROGRESS = {
  pending: 5,
  confirmed: 15,
  cutting: 30,
  stitching: 50,
  processing: 65,
  ready: 75,
  out_for_delivery: 90,
  delivered: 100,
  cancelled: 0,
};

// Estimated business-day duration for each stage (cumulative from order placement).
// Used to compute "X days remaining" and "Expected on <weekday>" on the tracking page.
const STAGE_DAYS_REMAINING = {
  pending: 7,
  confirmed: 6,
  cutting: 5,
  stitching: 3,
  processing: 2,
  ready: 1,
  out_for_delivery: 1,
  delivered: 0,
  cancelled: 0,
};

const StoreContext = createContext(undefined);

const computeConfiguredUnitPrice = (item) => {
  let price = item.product.price;
  if (item.customization?.addWaistcoat) price += 3000;
  if (item.customization?.suitOption === '2-piece') price *= 0.75;
  if (item.customization?.suitOption === 'blazer-only') price *= 0.5;
  if (item.customization?.suitOption === 'pants-only') price *= 0.3;
  if (item.customization?.purchaseMode === 'unstitched') price *= 0.6;
  return Math.round(price);
};

const normalizeTeamMember = (item) => ({
  id: item.id,
  fullName: item.full_name || item.fullName || (item.email ? item.email.split('@')[0] : 'Customer'),
  email: item.email,
  role: String(item.role || 'customer').toLowerCase(),
  emailVerified: Boolean(item.email_verified ?? item.emailVerified),
  createdAt: item.created_at || item.createdAt || null,
});

export const StoreProvider = ({ children }) => {
  const { user, hasRole } = useAuth();
  const [products, setProducts] = useState(seedProducts);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [orders, setOrders] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [khataSummary, setKhataSummary] = useState({ total_revenue: 0, outstanding_balance: 0, total_expenses: 0, net_profit: 0 });
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const payload = await apiRequest('/api/products', { skipAuth: true });
        if (!payload.length) {
          setProducts(seedProducts);
          setIsLoadingProducts(false);
          return;
        }
        const byId = new Map(seedProducts.map(item => [item.id, item]));
        payload.forEach(item => {
          const existing = byId.get(item.id);
          if (existing) {
            byId.set(item.id, { ...existing, ...item });
          } else {
            byId.set(item.id, item);
          }
        });
        setProducts(Array.from(byId.values()));
      } catch (_error) {
        setProducts(seedProducts);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    const loadUserScopedData = async () => {
      if (!user) {
        setOrders([]);
        setTeamMembers([]);
        return;
      }

      try {
        const nextOrders = await apiRequest('/api/orders');
        setOrders(nextOrders);
      } catch (_error) {
        setOrders([]);
      }

      try {
        const data = await apiRequest('/api/invoices');
        setInvoices(data?.items || []);
      } catch (e) {
        setInvoices([]);
      }

      if (hasRole('admin')) {
        try {
          const members = await apiRequest('/api/users/team');
          setTeamMembers((members || []).map(normalizeTeamMember));
        } catch (err) {
          try {
            const customers = await apiRequest('/api/users/customers');
            setTeamMembers((customers || []).map(normalizeTeamMember));
          } catch (innerErr) {
            console.error('Failed to load team/customers:', innerErr);
          }
        }

        try {
          const inv = await apiRequest('/api/inventory');
          setInventory(inv || []);
        } catch (err) {
          console.error('Failed to load inventory:', err);
        }

        try {
          const exp = await apiRequest('/api/khata/expenses');
          setExpenses(exp || []);
        } catch (err) {
          console.error('Failed to load expenses:', err);
        }

        try {
          const summary = await apiRequest('/api/khata/summary');
          setKhataSummary(summary || { total_revenue: 0, outstanding_balance: 0, total_expenses: 0, net_profit: 0 });
        } catch (err) {
          console.error('Failed to load khata summary:', err);
        }
      } else {
        setTeamMembers([]);
        setInventory([]);
        setExpenses([]);
      }
    };

    loadUserScopedData();
  }, [user, hasRole]);

  const value = useMemo(() => ({
    products,
    orders,
    teamMembers,
    invoices,
    refreshTeamMembers: async () => {
      try {
        const members = await apiRequest('/api/users/team');
        const normalized = (members || []).map(normalizeTeamMember);
        setTeamMembers(normalized);
        return normalized;
      } catch (e) {
        try {
          const customers = await apiRequest('/api/users/customers');
          const normalized = (customers || []).map(normalizeTeamMember);
          setTeamMembers(normalized);
          return normalized;
        } catch (innerErr) {
          console.error('Failed to refresh team members:', innerErr);
          throw innerErr;
        }
      }
    },
    refreshInvoices: async () => {
      try {
        const data = await apiRequest('/api/invoices');
        setInvoices(data?.items || []);
      } catch (e) { console.error('Failed to load invoices', e); }
    },
    downloadInvoicePdf: async (invoiceNumber) => {
      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
      const response = await fetch(`${API_BASE_URL}/api/invoices/${invoiceNumber}/pdf`, { headers });
      if (!response.ok) throw new Error('Failed to download PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TailorHub-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    emailInvoice: async (invoiceNumber) => {
      await apiRequest(`/api/invoices/${invoiceNumber}/email`, { method: 'POST' });
    },
    markInvoicePaid: async (invoiceNumber) => {
      await apiRequest(`/api/invoices/${invoiceNumber}/mark-paid`, { method: 'PATCH' });
      // Refresh list to show updated status
      const data = await apiRequest('/api/invoices');
      setInvoices(data?.items || []);
    },
    addProduct: async (payload) => {
      const created = await apiRequest('/api/products', { method: 'POST', body: { ...payload, id: payload.id || `prod-${Date.now()}` } });
      setProducts(prev => [created, ...prev.filter(item => item.id !== created.id)]);
      return created;
    },
    updateProduct: async (payload) => {
      const updated = await apiRequest(`/api/products/${payload.id}`, { method: 'PUT', body: payload });
      setProducts(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      return updated;
    },
    deleteProduct: async (productId) => {
      await apiRequest(`/api/products/${productId}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(item => item.id !== productId));
    },
    toggleProductSoldOut: async (product) => {
      try {
        const updated = await apiRequest(`/api/products/${product.id}/sold-out`, { method: 'PATCH' });
        setProducts(prev => prev.map(item => (item.id === updated.id ? updated : item)));
        return updated;
      } catch (err) {
        if (err.message.includes('404') || err.message.includes('not found')) {
          const payload = { ...product, isSoldOut: !product.isSoldOut };
          const created = await apiRequest('/api/products', { method: 'POST', body: payload });
          setProducts(prev => prev.map(item => (item.id === created.id ? created : item)));
          return created;
        }
        throw err;
      }
    },
    placeOrder: async (payload) => {
      const deliveryFee = payload.deliveryFee ?? 250;
      const lineItems = payload.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: computeConfiguredUnitPrice(item),
        color: item.customization.color,
        size: item.customization.size,
        purchaseMode: item.customization.purchaseMode,
        garmentCategory: item.product.category,
        measurementType: item.customization.measurementType || null,
        measurements: item.customization.measurements || null,
      }));
      const subtotal = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const advanceAmount = payload.paymentType === 'advance' ? (subtotal + deliveryFee) / 2 : 0;
      const orderPayload = {
        customerName: payload.customerName || 'Guest Customer',
        customerEmail: payload.customerEmail || 'guest@tailorhub.pk',
        totalAmount: subtotal + deliveryFee,
        advanceAmount: advanceAmount,
        notes: payload.notes,
        deliveryAddress: payload.deliveryAddress,
        deliveryPhone: payload.deliveryPhone,
        deliveryCity: payload.deliveryCity,
        items: lineItems,
      };
      const order = await apiRequest('/api/orders', { method: 'POST', body: orderPayload });
      setOrders(prev => [order, ...prev]);
      return order.id;
    },
    updateOrderStatus: async (orderId, status, extraPayload = {}) => {
      const updated = await apiRequest(`/api/orders/${orderId}/status`, { method: 'PATCH', body: { status, ...extraPayload } });
      setOrders(prev => prev.map(order => (order.id === updated.id ? updated : order)));
    },
    assignOrder: async (orderId, memberId) => {
      const updated = await apiRequest(`/api/orders/${orderId}/assign`, {
        method: 'PATCH',
        body: { assignedTo: memberId || null },
      });
      setOrders(prev => prev.map(order => (order.id === updated.id ? updated : order)));
    },
    deleteOrder: async (orderId) => {
      await apiRequest(`/api/orders/${orderId}`, { method: 'DELETE' });
      setOrders(prev => prev.filter(order => order.id !== orderId));
    },
    markPaymentPaid: async (paymentId) => {
      await apiRequest(`/api/payments/${paymentId}/mark-paid`, { method: 'PATCH' });
      // Refresh orders to show updated payment status
      const nextOrders = await apiRequest('/api/orders');
      setOrders(nextOrders);
    },
    refundOrder: async (orderId) => {
      await apiRequest(`/api/payments/${orderId}/refund`, { method: 'POST', body: {} });
      // Refresh orders to show updated payment/order status
      const nextOrders = await apiRequest('/api/orders');
      setOrders(nextOrders);
    },
    addTeamMember: async (payload) => {
      const created = await apiRequest('/api/users/team', { method: 'POST', body: payload });
      const normalized = normalizeTeamMember(created);
      setTeamMembers(prev => [normalized, ...prev.filter(item => item.id !== normalized.id)]);
      return normalized;
    },
    updateTeamMemberRole: async (memberId, role) => {
      const updated = await apiRequest(`/api/users/${memberId}/role`, { method: 'PATCH', body: { role } });
      const normalized = normalizeTeamMember(updated);
      setTeamMembers(prev => prev.map(member => (member.id === memberId ? normalized : member)));
    },
    deleteTeamMember: async (memberId) => {
      await apiRequest(`/api/users/${memberId}`, { method: 'DELETE' });
      setTeamMembers(prev => prev.filter(member => member.id !== memberId));
    },
    // ── Inventory ──
    addInventoryItem: async (payload) => {
      const created = await apiRequest('/api/inventory', { method: 'POST', body: payload });
      setInventory(prev => [created, ...prev]);
      return created;
    },
    deductStock: async (itemId, amount) => {
      const updated = await apiRequest(`/api/inventory/${itemId}/deduct?amount=${amount}`, { method: 'PATCH' });
      setInventory(prev => prev.map(item => (item.id === updated.id ? updated : item)));
    },
    toggleSoldOut: async (itemId) => {
      const updated = await apiRequest(`/api/inventory/${itemId}/sold-out`, { method: 'PATCH' });
      setInventory(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      return updated;
    },
    // ── Khata ──
    recordExpense: async (payload) => {
      const created = await apiRequest('/api/khata/expenses', { method: 'POST', body: payload });
      setExpenses(prev => [created, ...prev]);
      // Update summary after expense
      const summary = await apiRequest('/api/khata/summary');
      setKhataSummary(summary);
      return created;
    },
    addKhataEntry: async (payload) => {
      const created = await apiRequest('/api/khata/entry', { method: 'POST', body: payload });
      const [summary, nextOrders] = await Promise.all([
        apiRequest('/api/khata/summary'),
        apiRequest('/api/orders'),
      ]);
      setKhataSummary(summary);
      setOrders(nextOrders);
      return created;
    },
    refreshKhata: async () => {
      const summary = await apiRequest('/api/khata/summary');
      setKhataSummary(summary);
    },
    inventory,
    expenses,
    khataSummary,
    isLoadingProducts,
  }), [orders, products, teamMembers, inventory, expenses, khataSummary, isLoadingProducts]);

  return React.createElement(StoreContext.Provider, { value }, children);
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

export const getOrderProgress = status => ORDER_PROGRESS[status] ?? 0;

export const getDaysRemaining = status => STAGE_DAYS_REMAINING[status] ?? 0;

// Returns a Date representing when the order is expected to be delivered,
// based on the current status. If the order is already delivered or cancelled,
// returns null.
export const getExpectedCompletion = (status, fromDate = new Date()) => {
  const days = STAGE_DAYS_REMAINING[status];
  if (days == null || status === 'delivered' || status === 'cancelled') return null;
  const expected = new Date(fromDate);
  expected.setDate(expected.getDate() + days);
  return expected;
};
