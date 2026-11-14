import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  BookOpen,
  Layers,
} from 'lucide-react';
import type { Project, ProjectAIContext } from '../../types';

interface AIContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSaveContext: (context: ProjectAIContext) => Promise<void>;
  isRu: boolean;
}

const COMMON_TAGS = [
  'React 19',
  'TypeScript',
  'Tailwind CSS',
  'Vite',
  'Rust',
  'Tauri 2',
  'Node.js',
  'FastAPI',
  'Python',
  'SQLite',
  'PostgreSQL',
  'Docker',
  'REST API',
  'GraphQL',
];

export const AIContextModal: React.FC<AIContextModalProps> = ({
  isOpen,
  onClose,
  project,
  onSaveContext,
  isRu,
}) => {
  const [techStack, setTechStack] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [architecture, setArchitecture] = useState('');
  const [conventions, setConventions] = useState('');
  const [rules, setRules] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        if (project.ai_context) {
          const parsed: ProjectAIContext = JSON.parse(project.ai_context);
          setTechStack(parsed.techStack || []);
          setArchitecture(parsed.architecture || '');
          setConventions(parsed.conventions || '');
          setRules(parsed.rules || '');
          return;
        }
      } catch {}

      // Default template context
      setTechStack(['React 19', 'TypeScript', 'Tailwind CSS']);
      setArchitecture(
        'Modular component architecture with separated API client, state management and UI presentation.'
      );
      setConventions(
        'Use TypeScript strict mode. Prefer functional React components with hooks. Avoid "any".'
      );
      setRules(
        '# Project Rules (.nexus/rules.md)\n1. Never overwrite files without user confirmation.\n2. Keep styles consistent with the dark theme (#0B0B0E, #8B6CFF).\n3. All user text must support both Russian and English.'
      );
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || techStack.includes(trimmed)) return;
    setTechStack(prev => [...prev, trimmed]);
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setTechStack(prev => prev.filter(t => t !== tag));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ctx: ProjectAIContext = {
        techStack,
        architecture,
        conventions,
        rules,
      };
      await onSaveContext(ctx);
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
          maxWidth: 720,
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
              <Layers size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#F1F1F5' }}>
                {isRu ? 'AI Контекст Проекта' : 'Project AI Context'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#92929F' }}>
                {isRu
                  ? 'Стек, архитектура и правила разработки для автономного AI Агента'
                  : 'Tech stack, architecture and development rules for the AI Agent'}
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
            gap: 16,
          }}
        >
          {/* Tech Stack */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#F1F1F5',
                marginBottom: 6,
              }}
            >
              {isRu ? 'Стек технологий' : 'Technology Stack'}
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                padding: '10px 12px',
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 6,
                minHeight: 46,
                marginBottom: 8,
              }}
            >
              {techStack.map(tag => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    backgroundColor: 'rgba(139, 108, 255, 0.15)',
                    border: '1px solid rgba(139, 108, 255, 0.3)',
                    color: '#A78BFA',
                  }}
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#A78BFA',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(newTag);
                  }
                }}
                placeholder={isRu ? '+ Добавить тег...' : '+ Add tag...'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#F1F1F5',
                  fontSize: '0.75rem',
                  outline: 'none',
                  flex: 1,
                  minWidth: 100,
                }}
              />
            </div>

            {/* Quick Suggestions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#686877' }}>
                {isRu ? 'Быстрый выбор:' : 'Suggestions:'}
              </span>
              {COMMON_TAGS.filter(t => !techStack.includes(t)).slice(0, 8).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleAddTag(t)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontSize: '0.68rem',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    color: '#92929F',
                    cursor: 'pointer',
                  }}
                >
                  +{t}
                </button>
              ))}
            </div>
          </div>

          {/* Architecture Overview */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#F1F1F5',
                marginBottom: 6,
              }}
            >
              {isRu ? 'Архитектура и структура проекта' : 'Architecture & Structure'}
            </label>
            <textarea
              rows={3}
              value={architecture}
              onChange={e => setArchitecture(e.target.value)}
              placeholder={isRu ? 'Опишите организацию модулей, каталогов и ключевых сервисов...' : 'Describe modular layout, directories, and main subsystems...'}
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 6,
                color: '#F1F1F5',
                fontSize: '0.8rem',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Development Conventions */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#F1F1F5',
                marginBottom: 6,
              }}
            >
              {isRu ? 'Соглашения о коде (Conventions)' : 'Coding Conventions & Standards'}
            </label>
            <textarea
              rows={2}
              value={conventions}
              onChange={e => setConventions(e.target.value)}
              placeholder={isRu ? 'Например: camelCase, строгая типизация, обработка ошибок через Result...' : 'e.g. camelCase, strict typing, error handling rules...'}
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 6,
                color: '#F1F1F5',
                fontSize: '0.8rem',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Rules & .nexus/rules.md */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#F1F1F5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <BookOpen size={14} color="#8B6CFF" />
                {isRu ? 'Правила и инструкции для AI (.nexus/rules.md)' : 'AI Rules & Guidelines (.nexus/rules.md)'}
              </label>
              <span style={{ fontSize: '0.68rem', color: '#8B6CFF' }}>
                {isRu ? 'Внедряется в каждый системный промпт' : 'Injected into every AI system prompt'}
              </span>
            </div>
            <textarea
              rows={5}
              value={rules}
              onChange={e => setRules(e.target.value)}
              placeholder="# Project Rules..."
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: '#0B0B0E',
                border: '1px solid #25252D',
                borderRadius: 6,
                color: '#A78BFA',
                fontSize: '0.78rem',
                outline: 'none',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
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
            {isSaving ? (isRu ? 'Сохранение...' : 'Saving...') : isRu ? 'Сохранить контекст' : 'Save Context'}
          </button>
        </div>
      </div>
    </div>
  );
};
