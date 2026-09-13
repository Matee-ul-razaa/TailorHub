import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, User, LogOut, Scissors, Settings } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import NotificationBell from '@/components/ui/NotificationBell';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { totalItems } = useCart();
  const { user, fullName, signOut, hasRole } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  let navLinks = [];
  
  if (user && hasRole('delivery')) {
    // Rider only sees Tracking and Deliveries
    navLinks = [
      { to: '/tracking', label: t('nav.tracking', 'Tracking') },
      { to: '/delivery', label: t('nav.deliveries') },
    ];
  } else {
    // Standard view for customers and admins
    navLinks = [
      { to: '/', label: t('nav.home') },
      { to: '/catalog', label: t('nav.catalog') },
      { to: '/measurements', label: t('nav.measurements') },
      { to: '/skin-tone', label: t('nav.skinTone') },
      { to: '/virtual-try-on', label: t('nav.tryOn') },
      { to: '/tracking', label: t('nav.tracking', 'Tracking') },
    ];
    if (user && (hasRole('customer') || hasRole('admin'))) {
      navLinks.push({ to: '/invoices', label: t('invoice.myInvoices', 'Invoices') });
    }
    if (user && hasRole('admin')) navLinks.push({ to: '/admin', label: t('nav.admin') });
  }

  const isActive = (path) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav className={`glass-navbar sticky-top py-2 ${scrolled ? 'scrolled' : ''}`}>
      <div className="container d-flex align-items-center justify-content-between">
        {/* Logo */}
        <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none hover-lift">
          <div className="d-flex align-items-center justify-content-center rounded-circle shadow-lg" style={{ width: 40, height: 40, background: 'var(--th-accent-gradient)' }}>
            <Scissors size={20} color="white" />
          </div>
          <span className="font-playfair fw-bold fs-4" style={{
             background: 'var(--th-accent-gradient)',
             WebkitBackgroundClip: 'text',
             WebkitTextFillColor: 'transparent',
             letterSpacing: '-0.5px'
          }}>
            TailorHub
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="d-none d-xxl-flex align-items-center gap-3 mx-auto px-3">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} className={`th-nav-link ${isActive(link.to) ? 'active' : ''}`}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Controls */}
        <div className="d-flex align-items-center gap-2">
          <ThemeToggle />

          {/* Language Toggle */}
          <div className="d-none d-xxl-flex th-lang-toggle">
            <Button variant="ghost" size="sm" className={`th-lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>ENG</Button>
            <Button variant="ghost" size="sm" className={`th-lang-btn ${language === 'ur' ? 'active' : ''}`} onClick={() => setLanguage('ur')}>اردو</Button>
          </div>

          {/* Notifications - signed-in users only */}
          {user && <NotificationBell />}

          {/* Cart - Hidden for delivery riders */}
          {!hasRole('delivery') && (
            <Link to="/cart" className="position-relative d-inline-flex align-items-center justify-content-center p-2 text-decoration-none" style={{ lineHeight: 1, color: 'var(--th-primary)' }}>
              <ShoppingBag size={20} color="currentColor" />
              {totalItems > 0 && <span className="th-cart-badge">{totalItems}</span>}
            </Link>
          )}

          {/* Auth */}
          {user ? (
            <div className="d-none d-xxl-flex align-items-center gap-2">
              <span className="text-muted small text-truncate" style={{ maxWidth: '80px' }}>{fullName || user.email}</span>
              <Link to="/change-password" title="Change Password" className="d-inline-flex align-items-center justify-content-center p-2 text-decoration-none" style={{ lineHeight: 1, color: 'var(--th-primary)' }}>
                <Settings size={18} color="currentColor" />
              </Link>
              <button className="p-2 border-0 bg-transparent" onClick={handleSignOut} title="Sign out" style={{ lineHeight: 1, color: 'var(--th-primary)', cursor: 'pointer' }}>
                <LogOut size={18} color="currentColor" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="d-none d-xxl-block">
              <Button variant="outline" size="sm" className="d-flex align-items-center gap-2 rounded-pill px-3">
                <User size={16} /> {t('nav.login')}
              </Button>
            </Link>
          )}

          {/* Mobile Toggle */}
          <button className="d-xxl-none p-2 border-0 bg-transparent" onClick={() => setIsOpen(!isOpen)} style={{ lineHeight: 1, color: 'var(--th-primary)', cursor: 'pointer' }}>
            {isOpen ? <X size={20} color="currentColor" /> : <Menu size={20} color="currentColor" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="d-xxl-none border-top px-3 py-3 anim-fade-down" style={{ background: 'var(--th-card-bg)' }}>
          <div className="d-flex justify-content-center mb-3">
            <div className="th-lang-toggle">
              <Button variant="ghost" size="sm" className={`th-lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>ENG</Button>
              <Button variant="ghost" size="sm" className={`th-lang-btn ${language === 'ur' ? 'active' : ''}`} onClick={() => setLanguage('ur')}>اردو</Button>
            </div>
          </div>
          <div className="d-flex flex-column gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className={`rounded-3 px-3 py-2 small fw-medium text-decoration-none transition ${
                  isActive(link.to) ? 'bg-accent-light text-accent' : 'text-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <Button variant="outline" className="w-100 d-flex align-items-center justify-content-center gap-2 mt-2" onClick={() => { handleSignOut(); setIsOpen(false); }}>
                <LogOut size={16} /> {t('nav.signOut')}
              </Button>
            ) : (
              <Link to="/login" onClick={() => setIsOpen(false)}>
                <Button variant="outline" className="w-100 d-flex align-items-center justify-content-center gap-2 mt-2">
                  <User size={16} /> {t('nav.login')}
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
