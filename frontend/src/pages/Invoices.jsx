import React, { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { useStore } from '@/context/StoreContext';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { FileText, Download, Eye, Clock, CheckCircle2, AlertCircle, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function Invoices() {
  const { session } = useAuth();
  const { invoices, refreshInvoices, downloadInvoicePdf } = useStore();
  const { t, isUrdu } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Only load if authenticated
    if (session?.access_token) {
      refreshInvoices().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshInvoices, session]);

  const filteredInvoices = (invoices || []).filter(inv => {
    if (filter !== 'All' && inv.status.toLowerCase() !== filter.toLowerCase()) return false;
    if (search && !inv.invoice_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid': return <span className="th-badge bg-success bg-opacity-10 text-success"><CheckCircle2 size={12} className="me-1"/> {t('invoice.statusPaid', 'Paid')}</span>;
      case 'unpaid': return <span className="th-badge bg-warning bg-opacity-10 text-warning"><Clock size={12} className="me-1"/> {t('invoice.statusUnpaid', 'Unpaid')}</span>;
      case 'overdue': return <span className="th-badge bg-danger bg-opacity-10 text-danger"><AlertCircle size={12} className="me-1"/> {t('invoice.statusOverdue', 'Overdue')}</span>;
      case 'cancelled': return <span className="th-badge bg-secondary bg-opacity-10 text-secondary"><XCircle size={12} className="me-1"/> {t('invoice.statusCancelled', 'Cancelled')}</span>;
      default: return null;
    }
  };

  const handleDownload = async (number) => {
    try {
      await downloadInvoicePdf(number);
      toast.success(t('invoice.downloadSuccess', 'Invoice downloaded!'));
    } catch (err) {
      toast.error(t('invoice.downloadError', 'Failed to download invoice.'));
    }
  };

  if (!session?.access_token) {
    return (
        <Layout>
            <div className="container py-5 text-center">
                <h5>{t('invoice.loginRequired', 'Please login to view your invoices.')}</h5>
            </div>
        </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-5" dir={isUrdu ? 'rtl' : 'ltr'}>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
          <h2 className="font-playfair fw-bold mb-3 mb-md-0 d-flex align-items-center gap-2">
            <div className="d-inline-flex align-items-center justify-content-center rounded-circle" style={{ width: 40, height: 40, background: 'var(--th-accent-light)' }}>
                <FileText size={20} className="text-accent" />
            </div>
            {t('invoice.myInvoices', 'My Invoices')}
          </h2>
          <div className="d-flex flex-wrap gap-2">
            {['All', 'unpaid', 'paid', 'overdue'].map(f => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                onClick={() => setFilter(f)}
                style={{ borderRadius: '20px', padding: '0.25rem 1rem' }}
              >
                {t(`invoice.filter${f.charAt(0).toUpperCase() + f.slice(1)}`, f.charAt(0).toUpperCase() + f.slice(1))}
              </Button>
            ))}
          </div>
        </div>

        <div className="row g-3 mb-4">
            <div className="col-12 col-md-6 col-lg-4">
                <div className="th-card-static p-2 px-3 d-flex align-items-center gap-2" style={{ borderRadius: '30px' }}>
                    <Search size={18} className="text-muted" />
                    <input 
                        type="text" 
                        className="form-control border-0 shadow-none p-1 bg-transparent" 
                        placeholder={t('invoice.searchPlaceholder', 'Search invoice number...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {loading ? (
            <div className="d-flex justify-content-center py-5 my-5">
                <div className="spinner-border text-accent" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-5 my-5 th-card-static">
                <div className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3" style={{ width: 64, height: 64, background: 'var(--th-accent-light)' }}>
                    <FileText size={32} className="text-muted opacity-50" />
                </div>
                <h5 className="font-playfair fw-bold">{t('invoice.empty', 'No invoices found')}</h5>
                <p className="text-muted small mb-0">{t('invoice.emptyDesc', "You don't have any invoices matching your filters.")}</p>
            </div>
        ) : (
            <div className="row g-3">
                {filteredInvoices.map(inv => (
                    <div key={inv.id} className="col-12 col-md-6 col-lg-4">
                        <div className="th-card-static p-4 h-100 d-flex flex-column anim-scale-in">
                            <div className="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <span className="font-monospace text-muted small" style={{ letterSpacing: '0.05em' }}>{inv.invoice_number}</span>
                                    <h4 className="font-playfair fw-bold mb-0 mt-1" style={{ color: 'var(--th-primary)' }}>Rs. {inv.total_amount.toLocaleString()}</h4>
                                </div>
                                {getStatusBadge(inv.status)}
                            </div>
                            
                            <div className="small text-muted mb-4 flex-grow-1 p-3 rounded" style={{ background: 'var(--th-body-bg)' }}>
                                <div className="d-flex justify-content-between mb-2 pb-2 border-bottom">
                                    <span>{t('invoice.issueDate', 'Issued')}:</span>
                                    <span className="fw-medium text-dark">{new Date(inv.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <span>{t('invoice.dueDate', 'Due')}:</span>
                                    <span className={`fw-medium ${inv.status === 'overdue' ? 'text-danger' : 'text-dark'}`}>
                                        {new Date(inv.due_date).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="d-flex gap-2 mt-auto">
                                <Button className="flex-grow-1 d-flex justify-content-center align-items-center gap-2" onClick={() => handleDownload(inv.invoice_number)}>
                                    <Download size={16} />
                                    {t('invoice.actions.download', 'Download PDF')}
                                </Button>
                                <Button variant="outline" asChild>
                                    <a href={`/tracking?orderId=${inv.order_id}`} title={t('invoice.actions.viewOrder', 'View Order')}>
                                        <Eye size={18} />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </Layout>
  );
}
