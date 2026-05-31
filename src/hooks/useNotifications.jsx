import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const POLL_INTERVAL_MS = 30_000;

/**
 * useNotifications — fetch and poll the current user's notifications.
 *
 * Returns { items, unreadCount, refresh, markRead, markAllRead, loading, error }.
 * Polling auto-stops when the user signs out.
 */
export const useNotifications = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/notifications?limit=20');
      setItems(data?.items || []);
      setUnreadCount(data?.unread_count || 0);
    } catch (e) {
      setError(e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markRead = useCallback(
    async (id) => {
      try {
        await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
        setItems((prev) =>
          prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (_) {
        /* swallow */
      }
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    try {
      await apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
      setUnreadCount(0);
    } catch (_) {
      /* swallow */
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      return undefined;
    }
    refresh();
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, refresh]);

  return { items, unreadCount, loading, error, refresh, markRead, markAllRead };
};
