import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDialog: React.FC = () => {
  const { confirmDialog, closeConfirm, t } = useApp();

  if (!confirmDialog.isOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeConfirm}>
      <div className="modal-content" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle
              size={20}
              color={confirmDialog.danger ? '#ef4444' : 'var(--accent-primary)'}
            />
            <span className="modal-title">{confirmDialog.title}</span>
          </div>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {confirmDialog.message}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={closeConfirm}>
            {t.confirmDialog.cancel}
          </button>
          <button
            className={`btn ${confirmDialog.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={confirmDialog.onConfirm}
          >
            {confirmDialog.confirmLabel || t.confirmDialog.confirm}
          </button>
        </div>
      </div>
    </div>
  );
};
