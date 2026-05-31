import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import React from 'react';

// Mock dependencies
vi.mock('@/context/StoreContext', () => ({
  useStore: () => ({
    products: [],
    orders: [],
    teamMembers: [],
    inventory: [],
    expenses: [],
    khataSummary: { customers: [], total_receivable: 0, total_payable: 0, total_revenue: 0, total_expenses: 0, outstanding_balance: 0, net_profit: 0 },
    invoices: [],
    addProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    updateOrderStatus: vi.fn(),
    assignOrder: vi.fn(),
    deleteOrder: vi.fn(),
    addTeamMember: vi.fn(),
    updateTeamMemberRole: vi.fn(),
    deleteTeamMember: vi.fn(),
    addInventoryItem: vi.fn(),
    deductStock: vi.fn(),
    recordExpense: vi.fn(),
    addKhataEntry: vi.fn(),
    emailInvoice: vi.fn(),
    markInvoicePaid: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/components/layout/Layout', () => ({
  default: ({ children }) => React.createElement('div', { 'data-testid': 'layout' }, children),
}));

// Mock apiRequest based on URL to prevent race conditions during early component mount
vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn((url) => {
    if (url === '/api/analytics/orders-by-month') {
      return Promise.resolve([
        { month: '2026-01', count: 5, revenue: 12000 },
        { month: '2026-02', count: 8, revenue: 19000 },
      ]);
    }
    if (url === '/api/analytics/popular-categories') {
      return Promise.resolve([
        { category: 'shirts', value: 12 },
        { category: 'kurta', value: 8 },
      ]);
    }
    if (url === '/api/analytics/repeat-rate') {
      return Promise.resolve({
        repeat_rate: 45.0,
        repeat_customers: 9,
        total_customers: 20,
      });
    }
    if (url === '/api/analytics/avg-lead-time') {
      return Promise.resolve({
        avg_lead_time_days: 5.2,
      });
    }
    return Promise.resolve([]);
  }),
  getAuthToken: vi.fn().mockReturnValue('test-token'),
  clearAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
}));

// Mock recharts to avoid rendering SVGs and canvas issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  LineChart: ({ children }) => React.createElement('div', null, children),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  BarChart: ({ children }) => React.createElement('div', null, children),
  Bar: () => null,
  Cell: () => null,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Pencil: () => React.createElement('span', null, '✏️'),
  ShoppingBag: () => React.createElement('span', null, '🛍️'),
  Trash2: () => React.createElement('span', null, '🗑️'),
  Users: () => React.createElement('span', null, '👥'),
  Package: () => React.createElement('span', null, '📦'),
  TrendingUp: () => React.createElement('span', null, '📈'),
  FileText: () => React.createElement('span', null, '📄'),
  BookOpen: () => React.createElement('span', null, '📖'),
  Download: () => React.createElement('span', null, '⬇️'),
  Settings: () => React.createElement('span', null, '⚙️'),
  KeyRound: () => React.createElement('span', null, '🔑'),
  Clock: () => React.createElement('span', null, '🕒'),
  Loader2: () => React.createElement('span', null, '⏳'),
}));

const MockAdminDashboard = () => {
  return React.createElement(
    BrowserRouter,
    null,
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(
        AuthProvider,
        null,
        React.createElement(AdminDashboard, null)
      )
    )
  );
};

describe('AdminDashboard page', () => {
  beforeEach(() => {
    localStorage.setItem('tailorhub-language', 'en');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the admin dashboard and analytics charts', async () => {
    const apiModule = await import('@/lib/api');
    render(React.createElement(MockAdminDashboard));
    expect(screen.getByTestId('layout')).toBeInTheDocument();

    // Check that it calls our analytics endpoints
    await waitFor(() => {
      expect(apiModule.apiRequest).toHaveBeenCalledWith('/api/analytics/orders-by-month');
      expect(apiModule.apiRequest).toHaveBeenCalledWith('/api/analytics/popular-categories');
      expect(apiModule.apiRequest).toHaveBeenCalledWith('/api/analytics/repeat-rate');
      expect(apiModule.apiRequest).toHaveBeenCalledWith('/api/analytics/avg-lead-time');
    });

    // Check KPI rates render
    await waitFor(() => {
      const repeatCard = screen.getByText('Repeat Customer Rate').closest('div');
      expect(repeatCard.textContent).toContain('45%');
      
      const leadTimeCard = screen.getByText('Average Lead Time').closest('div');
      expect(leadTimeCard.textContent).toContain('5.2');
      expect(leadTimeCard.textContent).toContain('Days');

      expect(screen.getByText(/Monthly Orders/i)).toBeInTheDocument();
      expect(screen.getByText(/Popular Garment/i)).toBeInTheDocument();
    });
  });
});
