import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import ChatAssistant from '@/components/ui/ChatAssistant';
import { useAuth } from '@/context/AuthContext';

const Layout = ({ children }) => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Default: open on desktop (>=1200px), closed on smaller screens
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1200,
  );

  useEffect(() => {
    // TC-11: Restricted Rider Experience
    // If user is a rider, they should only see Delivery and Tracking pages.
    if (user && hasRole('delivery')) {
      const allowedPaths = ['/delivery', '/tracking', '/login'];
      // Check if current path is allowed
      const isAllowed = allowedPaths.some(path => location.pathname.startsWith(path));
      
      if (!isAllowed) {
        navigate('/delivery');
      }
    }
  }, [user, hasRole, location.pathname, navigate]);

  // Close sidebar whenever the route changes (menu selection)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Logged-in: dashboard shell with left sidebar + slim topbar
  if (user) {
    return (
      <div className="th-app-shell">
        <div className={`th-sidebar-wrap ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
        {sidebarOpen && (
          <div className="th-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}
        <div className="th-app-main">
          <Topbar onMenuToggle={() => setSidebarOpen(o => !o)} />
          <main className="flex-grow-1 anim-page-enter">
            {children}
          </main>
          {/* Hide ChatAssistant for delivery riders */}
          {!hasRole('delivery') && <ChatAssistant />}
        </div>
      </div>
    );
  }

  // Logged-out: marketing top navbar + footer
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-grow-1 anim-page-enter">
        {children}
      </main>
      <Footer />
      <ChatAssistant />
    </div>
  );
};

export default Layout;
