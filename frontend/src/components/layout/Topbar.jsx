import { Link, useLocation } from 'react-router-dom';
import { Menu, ShoppingBag, Home, Palette, Shirt, Truck, MapPin } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import NotificationBell from '@/components/ui/NotificationBell';
import { Button } from '@/components/ui/button';

const quickLinks = [
  { to: '/', labelKey: 'nav.home', fallback: 'Home', icon: Home },
  { to: '/catalog', labelKey: 'nav.catalog', fallback: 'Catalog', icon: ShoppingBag },
  { to: '/skin-tone', labelKey: 'nav.skinTone', fallback: 'Skin Tone', icon: Palette },
  { to: '/virtual-try-on', labelKey: 'nav.tryOn', fallback: 'Try On', icon: Shirt },
];

const Topbar = ({ onMenuToggle }) => {
  const { totalItems } = useCart();
  const { hasRole } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <header className="th-topbar">
      <button
        className="th-topbar-menu"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Quick links — always visible outside sidebar */}
      <nav className="th-topbar-nav d-none d-sm-flex">
        {(!hasRole('delivery') ? quickLinks : [
          { to: '/delivery', labelKey: 'nav.deliveries', fallback: 'Deliveries', icon: Truck },
          { to: '/tracking', labelKey: 'nav.tracking', fallback: 'Tracking', icon: MapPin }
        ]).map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`th-topbar-link ${isActive(item.to) ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{t(item.labelKey, item.fallback)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="ms-auto d-flex align-items-center gap-2">
        <div className="th-lang-toggle d-none d-sm-flex">
          <Button variant="ghost" size="sm" className={`th-lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>ENG</Button>
          <Button variant="ghost" size="sm" className={`th-lang-btn ${language === 'ur' ? 'active' : ''}`} onClick={() => setLanguage('ur')}>اردو</Button>
        </div>

        <ThemeToggle />
        <NotificationBell />

        {!hasRole('delivery') && (
          <Link
            to="/cart"
            className="position-relative d-inline-flex align-items-center justify-content-center p-2 text-decoration-none"
            style={{ lineHeight: 1, color: 'var(--th-primary)' }}
          >
            <ShoppingBag size={20} color="currentColor" />
            {totalItems > 0 && <span className="th-cart-badge">{totalItems}</span>}
          </Link>
        )}
      </div>
    </header>
  );
};

export default Topbar;
