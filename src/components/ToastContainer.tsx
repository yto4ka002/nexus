import React from 'react';
import { useApp } from '../context/AppContext';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 200,
        maxWidth: 360,
      }}
    >
      {toasts.map(t => {
        let icon = <Info size={18} color="#8b5cf6" />;
        let border = 'rgba(139, 92, 246, 0.4)';
        if (t.type === 'success') {
          icon = <CheckCircle2 size={18} color="#10b981" />;
          border = 'rgba(16, 185, 129, 0.4)';
        } else if (t.type === 'warning') {
          icon = <AlertTriangle size={18} color="#f59e0b" />;
          border = 'rgba(245, 158, 11, 0.4)';
        } else if (t.type === 'error') {
          icon = <AlertCircle size={18} color="#ef4444" />;
          border = 'rgba(239, 68, 68, 0.4)';
        }

        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 16px',
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${border}`,
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <div style={{ marginTop: 2 }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {t.title}
              </div>
              {t.description && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {t.description}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: 2,
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
