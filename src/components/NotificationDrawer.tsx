import React from 'react';
import { X, CheckCheck, Trash2, Bell, Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import * as api from '../api';

export const NotificationDrawer: React.FC = () => {
  const { isNotifDrawerOpen, setNotifDrawerOpen, notifications, refreshNotifications, addToast, language, t } = useApp();

  if (!isNotifDrawerOpen) return null;

  const isRu = language === 'ru';

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    await refreshNotifications();
    addToast(isRu ? 'Прочитано' : 'Marked as Read', isRu ? 'Все уведомления прочитаны' : 'All notifications updated', 'info');
  };

  const handleClearAll = async () => {
    await api.clearAllNotifications();
    await refreshNotifications();
    addToast(isRu ? 'Очищено' : 'Cleared', isRu ? 'История уведомлений очищена' : 'Notification history purged', 'info');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={16} color="#10b981" />;
      case 'warning':
        return <AlertTriangle size={16} color="#f59e0b" />;
      case 'error':
        return <AlertCircle size={16} color="#ef4444" />;
      default:
        return <Info size={16} color="#c084fc" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setNotifDrawerOpen(false)}>
      <div
        className="modal-content"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 390,
          maxWidth: '100%',
          height: '100vh',
          borderRadius: 0,
          borderLeft: '1px solid var(--border-strong)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          animation: 'slideInRight 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={18} color="var(--accent-primary)" />
            <span className="modal-title">{t.notifications.title}</span>
          </div>
          <button className="btn-icon" onClick={() => setNotifDrawerOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleMarkAllRead}>
            <CheckCheck size={14} /> {t.notifications.markRead}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleClearAll}>
            <Trash2 size={14} /> {t.notifications.clearAll}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
              {t.notifications.empty}
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: n.is_read ? 'var(--bg-card)' : 'rgba(139, 92, 246, 0.14)',
                  border: n.is_read ? '1px solid var(--border-subtle)' : '1px solid rgba(192, 132, 252, 0.35)',
                  display: 'flex',
                  gap: 12,
                }}
              >
                <div style={{ marginTop: 2 }}>{getIcon(n.notif_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{n.created_at}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{n.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
