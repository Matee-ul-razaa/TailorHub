import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Menu, X, User, LogOut, Scissors, Settings } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import NotificationBell from '@/components/ui/NotificationBell';

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
      { to: '/ai-measurements', label: t('nav.aiMeasure', 'AI Measure') },
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
        <div className="d-none d-xl-flex align-items-center gap-3">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} className={`th-nav-link ${isActive(link.to) ? 'active' : ''}`}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Controls */}
        <div className="d-flex align-items-center gap-3">
          <ThemeToggle />

          {/* Language Toggle */}
          <div className="d-none d-xl-flex th-lang-toggle">
            <button className={`th-lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>ENG</button>
            <button className={`th-lang-btn ${language === 'ur' ? 'active' : ''}`} onClick={() => setLanguage('ur')}>اردو</button>
          </div>

          {/* Notifications - signed-in users only */}
          {user && <NotificationBell />}

          {/* Cart - Hidden for delivery riders */}
          {!hasRole('delivery') && (
            <Link to="/cart" className="position-relative btn btn-light btn-sm rounded-circle p-2" style={{ lineHeight: 1 }}>
              <ShoppingBag size={20} />
              {totalItems > 0 && <span className="th-cart-badge">{totalItems}</span>}
            </Link>
          )}

          {/* Auth */}
          {user ? (
            <div className="d-none d-xl-flex align-items-center gap-2">
              <span className="text-muted small text-truncate" style={{ maxWidth: '80px' }}>{fullName || user.email}</span>
              <Link to="/change-password" title="Change Password" className="btn btn-light btn-sm rounded-circle p-2" style={{ lineHeight: 1 }}>
                <Settings size={16} />
              </Link>
              <button className="btn btn-light btn-sm rounded-circle p-2" onClick={handleSignOut} title="Sign out" style={{ lineHeight: 1 }}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="d-none d-xl-block">
              <button className="btn btn-outline-dark btn-sm d-flex align-items-center gap-2 rounded-pill px-3">
                <User size={16} /> {t('nav.login')}
              </button>
            </Link>
          )}

          {/* Mobile Toggle */}
          <button className="btn btn-light btn-sm d-xl-none rounded-circle p-2" onClick={() => setIsOpen(!isOpen)} style={{ lineHeight: 1 }}>
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="d-xl-none border-top bg-white px-3 py-3 anim-fade-down">
          <div className="d-flex justify-content-center mb-3">
            <div className="th-lang-toggle">
              <button className={`th-lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>ENG</button>
              <button className={`th-lang-btn ${language === 'ur' ? 'active' : ''}`} onClick={() => setLanguage('ur')}>اردو</button>
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
              <button className="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-center gap-2 mt-2" onClick={() => { handleSignOut(); setIsOpen(false); }}>
                <LogOut size={16} /> {t('nav.signOut')}
              </button>
            ) : (
              <Link to="/login" onClick={() => setIsOpen(false)}>
                <button className="btn btn-outline-dark btn-sm w-100 d-flex align-items-center justify-content-center gap-2 mt-2">
                  <User size={16} /> {t('nav.login')}
                </button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
