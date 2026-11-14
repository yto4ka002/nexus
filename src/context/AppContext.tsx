import React, { createContext, useContext, useState, useEffect } from 'react';
import type { SectionType, AppNotification, SystemStats, ToastMessage } from '../types';
import * as api from '../api';
import { translations, type Language } from '../i18n';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface AppContextType {
  activeSection: SectionType;
  setActiveSection: (sec: SectionType) => void;
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  systemStats: SystemStats | null;
  refreshSystemStats: () => Promise<void>;
  notifications: AppNotification[];
  unreadNotifsCount: number;
  refreshNotifications: () => Promise<void>;
  isNotifDrawerOpen: boolean;
  setNotifDrawerOpen: (open: boolean) => void;
  toasts: ToastMessage[];
  addToast: (title: string, description?: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  confirmDialog: ConfirmDialogState;
  showConfirm: (title: string, message: string, onConfirm: () => void, danger?: boolean, confirmLabel?: string) => void;
  closeConfirm: () => void;
  settings: Record<string, any>;
  updateSetting: (key: string, value: any) => Promise<void>;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['ru'];
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSection, setActiveSection] = useState<SectionType>('home');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Default to Russian and pure obsidian dark theme
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('nexus_lang');
    return (saved === 'en' || saved === 'ru') ? saved : 'ru';
  });

  const [settings, setSettings] = useState<Record<string, any>>({
    theme: 'cosmic-aurora',
    accentColor: '#8b5cf6',
    closeToTray: true,
    autostart: false,
    language: 'ru',
  });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const t = translations[language] || translations.ru;

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('nexus_lang', lang);
    updateSetting('language', lang);
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    danger: boolean = false,
    confirmLabel?: string
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      danger,
      confirmLabel: confirmLabel || t.confirmDialog.confirm,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  const addToast = (title: string, description?: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshSystemStats = async () => {
    try {
      const stats = await api.getSystemStats();
      setSystemStats(stats);
    } catch (err) {
      console.error('Failed to load system stats:', err);
    }
  };

  const refreshNotifications = async () => {
    try {
      const notifs = await api.getNotifications();
      setNotifications(notifs);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      await api.saveAppSetting(key, value);
      setSettings(prev => ({ ...prev, [key]: value }));
      if (key === 'language') {
        setLanguageState(value);
      }
    } catch (err) {
      addToast(
        language === 'ru' ? 'Ошибка' : 'Error',
        language === 'ru' ? 'Не удалось сохранить настройку' : 'Failed to save setting',
        'error'
      );
    }
  };

  // Initial load
  useEffect(() => {
    document.body.setAttribute('data-theme', 'cosmic-aurora');

    api.getAppSettings().then(cfg => {
      if (cfg) {
        setSettings(prev => ({ ...prev, ...cfg }));
        if (cfg.language && (cfg.language === 'ru' || cfg.language === 'en')) {
          setLanguageState(cfg.language);
        }
      }
    });

    refreshSystemStats();
    refreshNotifications();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Light telemetry background interval (every 3s)
    const sysInterval = setInterval(() => {
      refreshSystemStats();
    }, 3000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(sysInterval);
    };
  }, []);

  const unreadNotifsCount = notifications.filter(n => !n.is_read).length;

  return (
    <AppContext.Provider
      value={{
        activeSection,
        setActiveSection,
        selectedProjectId,
        setSelectedProjectId,
        systemStats,
        refreshSystemStats,
        notifications,
        unreadNotifsCount,
        refreshNotifications,
        isNotifDrawerOpen,
        setNotifDrawerOpen,
        toasts,
        addToast,
        removeToast,
        confirmDialog,
        showConfirm,
        closeConfirm,
        settings,
        updateSetting,
        language,
        setLanguage,
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
