import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Ruler, Sparkles, MapPin, FileText, LayoutDashboard, Truck, LogOut, Settings, Scissors, Home, ShoppingBag, Palette, Shirt
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

const Sidebar = ({ onNavigate }) => {
  const { user, fullName, roles, signOut, hasRole } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = useMemo(() => {
    if (hasRole('delivery')) {
      return [
        { to: '/delivery', label: t('nav.deliveries', 'Deliveries'), icon: Truck, mobileOnly: true },
        { to: '/tracking', label: t('nav.tracking', 'Tracking'), icon: MapPin, mobileOnly: true },
      ];
    }
    const items = [
      { to: '/', label: t('nav.home', 'Home'), icon: Home, mobileOnly: true },
      { to: '/catalog', label: t('nav.catalog', 'Catalog'), icon: ShoppingBag, mobileOnly: true },
      { to: '/skin-tone', label: t('nav.skinTone', 'Skin Tone'), icon: Palette, mobileOnly: true },
      { to: '/virtual-try-on', label: t('nav.tryOn', 'Try On'), icon: Shirt, mobileOnly: true },
      { to: '/measurements', label: t('nav.measurements', 'Measurements'), icon: Ruler },
      { to: '/tracking', label: t('nav.tracking', 'Tracking'), icon: MapPin },
    ];
    if (hasRole('customer') || hasRole('admin')) {
      items.push({ to: '/invoices', label: t('invoice.myInvoices', 'Invoices'), icon: FileText });
    }
    if (hasRole('admin')) {
      items.push({ to: '/admin', label: t('nav.admin', 'Admin'), icon: LayoutDashboard });
    }
    return items;
  }, [hasRole, t]);

  const isActive = (path) => location.pathname === path;
  const initial = (fullName || user?.email || '?').charAt(0).toUpperCase();
  const roleLabel = roles[0] ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1) : '';

  const handleSignOut = async () => {
    await signOut();
    if (onNavigate) onNavigate();
    navigate('/');
  };

  return (
    <aside className="th-sidebar">
      {/* Brand */}
      <div className="th-sidebar-brand">
        <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none" onClick={onNavigate}>
          <div className="th-sidebar-logo"><Scissors size={20} color="#fff" /></div>
          <div className="overflow-hidden">
            <div className="th-sidebar-title">TailorHub</div>
            <div className="th-sidebar-subtitle">{t('nav.studioTagline', 'Tailoring Studio')}</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="th-sidebar-nav">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`th-sidebar-link ${isActive(item.to) ? 'active' : ''} ${item.mobileOnly ? 'd-sm-none' : ''}`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="text-truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="th-sidebar-footer">
        <div className="th-sidebar-user">
          <div className="th-sidebar-avatar">{initial}</div>
          <div className="flex-grow-1 overflow-hidden">
            <div className="th-sidebar-username text-truncate">{fullName || user?.email}</div>
            <div className="th-sidebar-role">{roleLabel}</div>
          </div>
          <Link
            to="/change-password"
            title={t('nav.changePassword', 'Change Password')}
            onClick={onNavigate}
            className="th-sidebar-icon-btn"
          >
            <Settings size={16} />
          </Link>
        </div>
        <button className="th-sidebar-signout" onClick={handleSignOut}>
          <LogOut size={16} /> <span>{t('nav.signOut', 'Sign out')}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
