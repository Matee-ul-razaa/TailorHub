import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

const CompleteProfile = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const tempToken = searchParams.get('temp_token');
  
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    agree_terms: true
  });

  useEffect(() => {
    if (!tempToken) {
      toast.error("Invalid onboarding session.");
      navigate('/login');
    }
  }, [tempToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiRequest('/api/auth/oauth-complete', {
        method: 'POST',
        body: {
          temp_token: tempToken,
          phone: formData.phone,
          address: formData.address,
          agree_terms: formData.agree_terms
        }
      });
      
      // Write the session completely since CompleteProfile handles the final step
      const nextSession = { access_token: response.access_token, user_id: response.user_id };
      localStorage.setItem('tailorhub-auth-token', response.access_token);
      localStorage.setItem(
        'tailorhub-auth-session',
        JSON.stringify({ ...nextSession, role: response.role, email: response.email, full_name: response.full_name }),
      );
      
      toast.success("Profile completed successfully. Welcome!");
      window.location.href = '/'; // Hard reload to trick AuthContext into consuming the new localStorage
    } catch (err) {
      toast.error(err.message || 'Failed to complete profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="d-flex align-items-center justify-content-center p-4" style={{ minHeight: '70vh' }}>
        <div className="th-card-static p-0 shadow-lg anim-scale-in" style={{ maxWidth: 440, width: '100%' }}>
          <div className="text-center p-4 pb-2">
            <h4 className="font-playfair fw-bold">Complete Profile</h4>
            <p className="text-muted small">Just a few more details to set up your account</p>
          </div>
          <div className="p-4 pt-0">
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="th-label">Phone Number (Optional)</label>
                <input 
                  className="th-input"
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                  placeholder="e.g. +92 300 1234567" 
                />
              </div>
              <div className="mb-3">
                <label className="th-label">Default Address (Optional)</label>
                <input 
                  className="th-input"
                  value={formData.address} 
                  onChange={(e) => setFormData({...formData, address: e.target.value})} 
                  placeholder="Your delivery address" 
                />
              </div>
              
              <div className="d-flex align-items-center gap-2 pt-2 mb-4">
                <input 
                  type="checkbox" 
                  id="terms" 
                  checked={formData.agree_terms} 
                  onChange={(e) => setFormData({...formData, agree_terms: e.target.checked})}
                  className="form-check-input"
                  style={{ width: 18, height: 18 }}
                />
                <label htmlFor="terms" className="text-muted small mb-0">
                  I agree to the Terms of Service
                </label>
              </div>

              <button type="submit" className="btn btn-accent w-100 d-flex align-items-center justify-content-center gap-2" disabled={loading || !formData.agree_terms}>
                {loading ? <Loader2 size={16} className="anim-spin" /> : null}
                {loading ? 'Finalizing Profile...' : 'Complete Registration'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CompleteProfile;
