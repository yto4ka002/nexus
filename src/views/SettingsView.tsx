import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Palette,
  Power,
  Keyboard,
  Database,
  Info,
  Download,
  Upload,
  CheckCircle2,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import * as api from '../api';

export const SettingsView: React.FC = () => {
  const { settings, updateSetting, addToast, showConfirm, language, setLanguage, t } = useApp();
  const isRu = language === 'ru';

  const [dbPath, setDbPath] = useState('');
  const [importContent, setImportContent] = useState('');

  useEffect(() => {
    api.getDbPath().then(setDbPath);
  }, []);

  const handleExportBackup = async () => {
    try {
      const json = await api.exportBackupJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast(
        isRu ? 'Резервная копия экспортирована' : 'Backup Exported',
        isRu ? 'JSON-файл бэкапа успешно скачан' : 'Downloaded backup JSON file',
        'success'
      );
    } catch (e: any) {
      addToast(isRu ? 'Ошибка экспорта' : 'Export Error', String(e), 'error');
    }
  };

  const handleImportBackup = () => {
    if (!importContent.trim()) {
      addToast(isRu ? 'Ошибка' : 'Error', isRu ? 'Вставьте содержимое JSON бэкапа в текстовое поле' : 'Paste JSON backup content into the field', 'error');
      return;
    }

    showConfirm(
      isRu ? 'Восстановить данные из резервной копии?' : 'Restore Backup?',
      isRu
        ? 'Восстановление резервной копии объединит сохраненные задачи, заметки и настройки с текущей базой данных.'
        : 'Restoring a backup will insert saved tasks, notes, and records into the database.',
      async () => {
        try {
          const res = await api.importBackupJson(importContent);
          addToast(isRu ? 'База данных восстановлена' : 'Backup Restored', res, 'success');
          setImportContent('');
        } catch {
          addToast(isRu ? 'Ошибка восстановления' : 'Restore Failed', isRu ? 'Неверный формат JSON бэкапа' : 'Invalid JSON backup format', 'error');
        }
      },
      false,
      isRu ? 'Восстановить' : 'Restore Data'
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 950, margin: '0 auto' }}>
      {/* Header */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '20px 26px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SettingsIcon size={26} color="#c084fc" />
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>{t.settings.title}</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t.settings.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* 1. LANGUAGE & LOCALIZATION */}
      <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={18} color="#38bdf8" />
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{t.settings.languageLabel}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <button
            onClick={() => setLanguage('ru')}
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: language === 'ru' ? '2px solid #c084fc' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: language === 'ru' ? '0 0 16px rgba(139, 92, 246, 0.35)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🇷🇺 {t.settings.languageRu}</span>
            {language === 'ru' && <CheckCircle2 size={16} color="#c084fc" />}
          </button>

          <button
            onClick={() => setLanguage('en')}
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: language === 'en' ? '2px solid #38bdf8' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'var(--text-main)',
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: language === 'en' ? '0 0 16px rgba(56, 189, 248, 0.35)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🇬🇧 {t.settings.languageEn}</span>
            {language === 'en' && <CheckCircle2 size={16} color="#38bdf8" />}
          </button>
        </div>
      </div>

      {/* 2. APPEARANCE & THEMES */}
      <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Palette size={18} color="#c084fc" />
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{t.settings.appearanceSection}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="form-label">{t.settings.themeLabel}</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {[
              {
                id: 'cosmic-aurora',
                label: isRu ? 'Nexus Obsidian (Черно-фиолетовый)' : 'Nexus Obsidian (Black & Purple)',
                color: '#c084fc',
                gradient: 'linear-gradient(135deg, #07060c 0%, #7c3aed 50%, #c084fc 100%)',
                featured: true,
              },
              {
                id: 'midnight-violet',
                label: isRu ? 'Midnight Violet (Темно-фиолетовый)' : 'Midnight Violet',
                color: '#8b5cf6',
                gradient: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
                featured: false,
              },
              {
                id: 'cyber-blue',
                label: isRu ? 'Cyber Blue (Кибер-синий)' : 'Cyber Blue',
                color: '#38bdf8',
                gradient: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                featured: false,
              },
              {
                id: 'neon-matrix',
                label: isRu ? 'Neon Matrix (Изумруд)' : 'Neon Matrix',
                color: '#34d399',
                gradient: 'linear-gradient(135deg, #059669, #10b981)',
                featured: false,
              },
              {
                id: 'deep-slate',
                label: isRu ? 'Deep Slate (Грифельный)' : 'Deep Slate',
                color: '#94a3b8',
                gradient: 'linear-gradient(135deg, #475569, #64748b)',
                featured: false,
              },
            ].map(theme => {
              const isActive = (settings.theme || 'cosmic-aurora') === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => updateSetting('theme', theme.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface)',
                    border: isActive
                      ? `2px solid ${theme.color}`
                      : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    color: 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    boxShadow: isActive ? `0 0 16px ${theme.color}45` : 'none',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: theme.gradient,
                      boxShadow: `0 0 8px ${theme.color}`,
                      flexShrink: 0,
                    }}
                  />
                  <span>{theme.label}</span>
                  {theme.featured && (
                    <Sparkles size={14} color="#c084fc" style={{ marginLeft: 'auto' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. LAUNCH & WINDOW BEHAVIOR */}
      <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Power size={18} color="#3b82f6" />
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{t.settings.behaviorSection}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Close to tray */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.settings.closeToTray}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {isRu
                  ? 'При нажатии на крестик NEXUS свернется в трей рядом с часами Windows вместо выхода.'
                  : 'Keep NEXUS active in the background when the main window is closed.'}
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.closeToTray ?? true}
                onChange={e => updateSetting('closeToTray', e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          {/* Autostart */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.settings.autostart}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {isRu
                  ? 'Запускать приложение в фоновом режиме автоматически при включении компьютера.'
                  : 'Automatically run NEXUS in background tray when computer starts.'}
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.autostart ?? true}
                onChange={e => updateSetting('autostart', e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
      </div>

      {/* 4. KEYBOARD SHORTCUTS */}
      <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Keyboard size={18} color="#fbbf24" />
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{t.settings.hotkeyLabel}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.header.searchPlaceholder}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isRu
                ? 'Открывает окно быстрого поиска и выполнения команд поверх любых окон Windows.'
                : 'Summons the command palette anywhere in Windows above all windows.'}
            </div>
          </div>
          <span className="kbd-shortcut" style={{ padding: '6px 14px', fontSize: '0.88rem' }}>
            Ctrl + Space
          </span>
        </div>
      </div>

      {/* 5. LOCAL DATA & BACKUPS */}
      <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Database size={18} color="#10b981" />
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{t.settings.dataSection}</span>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{t.settings.dbLocation}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.84rem', color: 'var(--text-main)', marginTop: 4, wordBreak: 'break-all' }}>
            {dbPath || (isRu ? 'Определение пути...' : 'Loading...')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} /> {isRu ? 'Режим SQLite WAL активен • 100% Локально и конфиденциально' : 'SQLite WAL mode active • 100% Offline & Private'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleExportBackup}>
            <Download size={16} /> {t.settings.exportBackup}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <label className="form-label">{t.settings.importBackup}</label>
          <textarea
            className="form-textarea"
            style={{ minHeight: 90, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
            placeholder={isRu ? 'Вставьте содержимое экспортированного JSON-файла бэкапа сюда...' : 'Paste exported JSON content here to restore...'}
            value={importContent}
            onChange={e => setImportContent(e.target.value)}
          />
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={handleImportBackup}>
            <Upload size={14} /> {t.settings.importBackup}
          </button>
        </div>
      </div>

      {/* 6. ABOUT NEXUS */}
      <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Info size={18} color="var(--text-muted)" />
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>{t.settings.aboutSection}</span>
        </div>

        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-main)' }}>NEXUS v1.0.0</strong> — {isRu ? 'Единый центр управления рабочим пространством и компьютером для Windows 11.' : 'Unified Personal Command & Control Center for Windows 11.'}
          <br />
          {isRu ? 'Стек технологий:' : 'Built with:'} <strong style={{ color: '#c084fc' }}>Rust</strong>, <strong style={{ color: '#38bdf8' }}>Tauri 2</strong>, <strong style={{ color: '#34d399' }}>React 19</strong>, <strong style={{ color: '#fbbf24' }}>SQLite WAL</strong>.
          <br />
          {isRu ? 'Все данные хранятся локально на вашем ПК без сторонних серверов.' : 'Zero external telemetry. All data remains strictly local on your PC.'}
        </div>
      </div>
    </div>
  );
};
