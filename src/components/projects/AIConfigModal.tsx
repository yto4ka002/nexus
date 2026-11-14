import React, { useState, useEffect } from 'react';
import {
  X,
  Bot,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Save,
  Loader2,
  Sparkles,
} from 'lucide-react';
import * as api from '../../api';
import type { AIProviderConfig } from '../../types';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRu: boolean;
}

const DEFAULT_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    apiKey: '',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    isActive: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    provider: 'anthropic',
    apiKey: '',
    endpoint: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    isActive: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'gemini',
    apiKey: '',
    endpoint: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-1.5-pro',
    isActive: false,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local / Offline)',
    provider: 'ollama',
    apiKey: '',
    endpoint: 'http://localhost:11434',
    defaultModel: 'llama3:latest',
    isActive: false,
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    provider: 'custom',
    apiKey: '',
    endpoint: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-70b-versatile',
    isActive: false,
  },
];

export const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose, isRu }) => {
  const [providers, setProviders] = useState<AIProviderConfig[]>(DEFAULT_PROVIDERS);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('openai');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const stored = await api.getAppSetting('ai_providers');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProviders(parsed);
          const active = parsed.find((p: AIProviderConfig) => p.isActive);
          if (active) setSelectedProviderId(active.id);
        }
      }
    } catch {
      // Keep defaults
    }
  };

  if (!isOpen) return null;

  const current = providers.find(p => p.id === selectedProviderId) || providers[0];

  const updateCurrentProvider = (fields: Partial<AIProviderConfig>) => {
    setProviders(prev =>
      prev.map(p => {
        if (p.id === current.id) {
          return { ...p, ...fields };
        }
        return p;
      })
    );
  };

  const handleSetActive = (id: string) => {
    setSelectedProviderId(id);
    setProviders(prev =>
      prev.map(p => ({
        ...p,
        isActive: p.id === id,
      }))
    );
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const reply = await api.aiChat(
        current.provider,
        current.apiKey || '',
        current.defaultModel,
        current.endpoint,
        'You are an AI connectivity tester. Reply strictly with: OK: Model ready.',
        'Ping'
      );
      setTestResult({
        success: true,
        message: `${isRu ? 'Соединение успешно!' : 'Connection successful!'} ${reply.substring(0, 80)}`,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `${isRu ? 'Ошибка проверки' : 'Test failed'}: ${String(err)}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await api.saveAppSetting('ai_providers', JSON.stringify(providers));
      const active = providers.find(p => p.isActive);
      if (active) {
        await api.saveAppSetting('ai_active_provider', active.id);
      }
      setIsSaving(false);
      onClose();
    } catch {
      setIsSaving(false);
    }
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
          maxWidth: 680,
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
              <Bot size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#F1F1F5' }}>
                {isRu ? 'Настройки AI Провайдеров' : 'AI Provider Settings'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#92929F' }}>
                {isRu
                  ? 'Управление ключами, моделями и локальными серверами (Ollama)'
                  : 'Manage API keys, models, and local LLM endpoints'}
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

        {/* Body: Two columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Provider List */}
          <div
            style={{
              width: 220,
              borderRight: '1px solid #25252D',
              backgroundColor: '#0B0B0E',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              overflowY: 'auto',
            }}
          >
            <span
              style={{
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: '#686877',
                padding: '6px 8px',
              }}
            >
              {isRu ? 'Провайдеры' : 'Providers'}
            </span>

            {providers.map(p => {
              const isSelected = p.id === current.id;
              const isActive = p.isActive;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSetActive(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 5,
                    border: isSelected ? '1px solid rgba(139, 108, 255, 0.4)' : '1px solid transparent',
                    backgroundColor: isSelected ? 'rgba(139, 108, 255, 0.1)' : 'transparent',
                    color: isSelected ? '#F1F1F5' : '#92929F',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: isActive ? '#10b981' : '#454555',
                      }}
                    />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </span>
                  </div>
                  {isActive && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: '#8B6CFF',
                        backgroundColor: 'rgba(139, 108, 255, 0.15)',
                        padding: '1px 5px',
                        borderRadius: 3,
                      }}
                    >
                      {isRu ? 'Активен' : 'Active'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Configuration Form */}
          <div
            style={{
              flex: 1,
              padding: 20,
              backgroundColor: '#111115',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Active Status Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 6,
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#F1F1F5' }}>
                  {isRu ? 'Использовать по умолчанию' : 'Use as Active Provider'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#92929F' }}>
                  {isRu ? 'Все запросы AI будут направляться через этот сервис' : 'Direct project AI requests here'}
                </div>
              </div>
              <input
                type="checkbox"
                checked={current.isActive}
                onChange={e => updateCurrentProvider({ isActive: e.target.checked })}
                style={{
                  width: 18,
                  height: 18,
                  accentColor: '#8B6CFF',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Model Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#92929F',
                  marginBottom: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Cpu size={14} color="#8B6CFF" />
                  {isRu ? 'Идентификатор модели' : 'Model Name'}
                </div>
              </label>
              <input
                type="text"
                value={current.defaultModel}
                onChange={e => updateCurrentProvider({ defaultModel: e.target.value })}
                placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022, llama3"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: '#16161C',
                  border: '1px solid #25252D',
                  borderRadius: 6,
                  color: '#F1F1F5',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* API Key (if not local ollama) */}
            {current.provider !== 'ollama' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#92929F',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Key size={14} color="#8B6CFF" />
                    {isRu ? 'API Ключ' : 'API Key'}
                  </div>
                </label>
                <input
                  type="password"
                  value={current.apiKey || ''}
                  onChange={e => updateCurrentProvider({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 6,
                    color: '#F1F1F5',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Custom Endpoint */}
            {(current.provider === 'ollama' || current.provider === 'custom' || current.provider === 'openai') && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#92929F',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={14} color="#8B6CFF" />
                    {isRu ? 'URL эндпоинта' : 'API Endpoint URL'}
                  </div>
                </label>
                <input
                  type="text"
                  value={current.endpoint || ''}
                  onChange={e => updateCurrentProvider({ endpoint: e.target.value })}
                  placeholder="https://... or http://localhost:11434"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 6,
                    color: '#F1F1F5',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* Connection Test feedback */}
            {testResult && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  backgroundColor: testResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${testResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: testResult.success ? '#10b981' : '#ef4444',
                }}
              >
                {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span style={{ lineHeight: 1.4 }}>{testResult.message}</span>
              </div>
            )}

            {/* Test Connection Button */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 14px',
                  backgroundColor: '#16161C',
                  border: '1px solid #25252D',
                  borderRadius: 6,
                  color: '#F1F1F5',
                  fontSize: '0.78rem',
                  cursor: isTesting ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {isTesting ? (
                  <Loader2 size={14} className="spin" color="#8B6CFF" />
                ) : (
                  <Sparkles size={14} color="#8B6CFF" />
                )}
                {isTesting
                  ? isRu ? 'Проверка...' : 'Testing...'
                  : isRu ? 'Проверить соединение' : 'Test Connection'}
              </button>
            </div>
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
            onClick={handleSaveAll}
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
            {isSaving ? (isRu ? 'Сохранение...' : 'Saving...') : isRu ? 'Сохранить' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
