import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  FileEdit,
  Trash2,
  Terminal,
  Save,
  Check,
} from 'lucide-react';
import type { Project, AIPermissions } from '../../types';

interface AIPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSavePermissions: (permissions: AIPermissions) => Promise<void>;
  isRu: boolean;
}

const DEFAULT_PERMISSIONS: AIPermissions = {
  fileWrite: 'ask',
  fileDelete: 'ask',
  terminalExec: 'ask',
};

export const AIPermissionsModal: React.FC<AIPermissionsModalProps> = ({
  isOpen,
  onClose,
  project,
  onSavePermissions,
  isRu,
}) => {
  const [permissions, setPermissions] = useState<AIPermissions>(DEFAULT_PERMISSIONS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        if (project.ai_permissions) {
          const parsed: AIPermissions = JSON.parse(project.ai_permissions);
          setPermissions(parsed);
          return;
        }
      } catch {}
      setPermissions(DEFAULT_PERMISSIONS);
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSavePermissions(permissions);
      setIsSaving(false);
      onClose();
    } catch {
      setIsSaving(false);
    }
  };

  const renderOptionRow = (
    key: keyof AIPermissions,
    title: string,
    desc: string,
    icon: React.ReactNode
  ) => {
    const currentValue = permissions[key];

    const options: { val: 'allow' | 'ask' | 'deny'; label: string; color: string }[] = [
      { val: 'allow', label: isRu ? 'Разрешено' : 'Allow', color: '#10b981' },
      { val: 'ask', label: isRu ? 'С подтверждением' : 'Ask Confirm', color: '#8B6CFF' },
      { val: 'deny', label: isRu ? 'Запрещено' : 'Deny', color: '#ef4444' },
    ];

    return (
      <div
        style={{
          padding: '14px 16px',
          backgroundColor: '#16161C',
          border: '1px solid #25252D',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 5,
                backgroundColor: 'rgba(139, 108, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8B6CFF',
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#F1F1F5' }}>{title}</div>
              <div style={{ fontSize: '0.72rem', color: '#92929F', marginTop: 2 }}>{desc}</div>
            </div>
          </div>
        </div>

        {/* 3-way toggle button group */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#0B0B0E',
            border: '1px solid #25252D',
            borderRadius: 5,
            padding: 3,
            gap: 4,
          }}
        >
          {options.map(opt => {
            const isSelected = currentValue === opt.val;
            return (
              <button
                key={opt.val}
                type="button"
                onClick={() => setPermissions(prev => ({ ...prev, [key]: opt.val }))}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 4,
                  border: isSelected ? `1px solid ${opt.color}40` : '1px solid transparent',
                  backgroundColor: isSelected ? `${opt.color}15` : 'transparent',
                  color: isSelected ? opt.color : '#92929F',
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isSelected && <Check size={12} />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          backgroundColor: '#111115',
          border: '1px solid #25252D',
          borderRadius: 8,
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #25252D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0B0B0E',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: 'rgba(139, 108, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8B6CFF',
                border: '1px solid rgba(139, 108, 255, 0.25)',
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#F1F1F5' }}>
                {isRu ? 'Безопасность и Права AI' : 'AI Security & Permissions'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#92929F' }}>
                {isRu
                  ? 'Контроль доступа автономного агента к файлам и терминалу'
                  : 'Control agent access to project files and terminal operations'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#92929F',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 4,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {renderOptionRow(
            'fileWrite',
            isRu ? 'Редактирование файлов проекта' : 'Modify & Overwrite Files',
            isRu
              ? 'Разрешить AI изменять существующие исходные коды в проекте'
              : 'Allow AI to write modifications into existing project source code',
            <FileEdit size={16} />
          )}

          {renderOptionRow(
            'fileDelete',
            isRu ? 'Создание и удаление файлов' : 'Create & Delete Files',
            isRu
              ? 'Создание новых файлов или удаление устаревших модулей'
              : 'Allow creating new files or removing deprecated modules',
            <Trash2 size={16} />
          )}

          {renderOptionRow(
            'terminalExec',
            isRu ? 'Выполнение команд в терминале' : 'Run Terminal Commands',
            isRu
              ? 'Запуск сборок, тестов, npm/cargo/pip команд через терминал'
              : 'Allow executing build commands, tests, npm/cargo/pip tools',
            <Terminal size={16} />
          )}

          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(139, 108, 255, 0.05)',
              border: '1px solid rgba(139, 108, 255, 0.2)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.74rem',
              color: '#A78BFA',
            }}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>
              {isRu
                ? 'Режим "С подтверждением" показывает всплывающее окно с Diff перед каждым изменением.'
                : '"Ask Confirm" mode prompts an interactive Diff preview before any file modification.'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #25252D',
            backgroundColor: '#0B0B0E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              backgroundColor: 'transparent',
              border: '1px solid #25252D',
              borderRadius: 6,
              color: '#92929F',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            {isRu ? 'Отмена' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 18px',
              backgroundColor: '#8B6CFF',
              border: 'none',
              borderRadius: 6,
              color: '#0B0B0E',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: isSaving ? 'wait' : 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Save size={14} />
            {isSaving ? (isRu ? 'Сохранение...' : 'Saving...') : isRu ? 'Сохранить права' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
};
