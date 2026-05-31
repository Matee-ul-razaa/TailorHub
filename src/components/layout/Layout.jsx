import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ChatAssistant from '@/components/ui/ChatAssistant';
import { useAuth } from '@/context/AuthContext';

const Layout = ({ children }) => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-grow-1 anim-page-enter">
        {children}
      </main>
      <Footer />
      {/* Hide ChatAssistant for delivery riders */}
      {(!user || !hasRole('delivery')) && <ChatAssistant />}
    </div>
  );
};

export default Layout;
