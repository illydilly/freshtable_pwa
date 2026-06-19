import { useEffect, useRef } from 'react';
import { api } from '../lib/api';

export function NotificationWatcher() {
  const shownIdsRef = useRef(new Set());
  const intervalRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !("Notification" in window)) return undefined;

    let disposed = false;

    const clearPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const boot = async () => {
      clearPolling();

      try {
        const { data: settings } = await api.get('/settings/notifications');
        if (disposed) return;
        if (!settings.browserNotificationsEnabled || Notification.permission !== 'granted') return;

        const poll = async () => {
          const { data } = await api.get('/notifications/check');
          const notifications = data.notifications || [];
          notifications.forEach((item) => {
            if (shownIdsRef.current.has(item.id)) return;
            shownIdsRef.current.add(item.id);
            new Notification(item.title, {
              body: item.message,
              tag: item.id
            });
          });
        };

        await poll();
        intervalRef.current = setInterval(poll, Math.max(settings.checkIntervalMinutes, 5) * 60 * 1000);
      } catch (error) {
        console.error('notification watcher error', error);
      }
    };

    boot();
    window.addEventListener('notification-settings-changed', boot);

    return () => {
      disposed = true;
      clearPolling();
      window.removeEventListener('notification-settings-changed', boot);
    };
  }, []);

  return null;
}
