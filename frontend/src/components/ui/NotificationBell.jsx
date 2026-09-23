import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/context/LanguageContext';

const formatTime = (iso, isUrdu) => {
  if (!iso) return '';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return isUrdu ? 'ابھی ابھی' : 'just now';
  if (m < 60) return isUrdu ? `${m} منٹ پہلے` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return isUrdu ? `${h} گھنٹے پہلے` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return isUrdu ? `${d} دن پہلے` : `${d}d ago`;
  return isUrdu ? date.toLocaleDateString('ur-PK') : date.toLocaleDateString();
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const { t, isUrdu } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleItemClick = async (n) => {
    if (!n.read_at) await markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div ref={wrapRef} className="position-relative">
      <button
        className="p-2 position-relative border-0 bg-transparent"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
        style={{ color: 'var(--th-primary)', lineHeight: 1, cursor: 'pointer' }}
      >
        <Bell size={18} color="currentColor" />
        {unreadCount > 0 && (
          <span
            className="th-cart-badge"
            style={{ background: '#ef4444', color: 'white' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`position-absolute ${isUrdu ? 'start-0' : 'end-0'} mt-2 shadow-lg border rounded-3 bg-white`}
          style={{ width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 1050 }}
          dir={isUrdu ? 'rtl' : 'ltr'}
        >
          <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
            <strong className="small">{t('notifications.title')}</strong>
            {unreadCount > 0 && (
              <button
                className="p-0 border-0 bg-transparent text-amber-600 small d-flex align-items-center gap-1"
                onClick={markAllRead}
                style={{ cursor: 'pointer' }}
              >
                <Check size={14} />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center text-muted small py-4">{t('notifications.empty')}</div>
          ) : (
            <ul className="list-unstyled mb-0">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`px-3 py-2 border-bottom ${n.read_at ? '' : 'bg-accent-light'}`}
                  style={{ cursor: n.link ? 'pointer' : 'default' }}
                  onClick={() => handleItemClick(n)}
                >
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div className="grow">
                      <div className="fw-semibold small">{n.title}</div>
                      {n.body && <div className="text-muted small">{n.body}</div>}
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        {formatTime(n.created_at, isUrdu)}
                      </div>
                    </div>
                    {!n.read_at && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: '#3b82f6',
                          marginTop: 6,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
