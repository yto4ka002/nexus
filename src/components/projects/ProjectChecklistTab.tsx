import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import * as api from '../../api';
import type { Project, ProjectChecklistItem } from '../../types';

interface ProjectChecklistTabProps {
  project: Project;
  onProjectUpdated: (updated: Project) => void;
  isRu: boolean;
}

export const ProjectChecklistTab: React.FC<ProjectChecklistTabProps> = ({
  project,
  onProjectUpdated,
  isRu,
}) => {
  const [items, setItems] = useState<ProjectChecklistItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [inputPriority, setInputPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    // Parse items from project.notes
    if (!project.notes) {
      setItems([]);
      return;
    }

    try {
      const parsed = JSON.parse(project.notes);
      if (Array.isArray(parsed)) {
        setItems(parsed);
      } else {
        // Plain text fallback: split by lines
        setItems(convertTextToItems(String(parsed)));
      }
    } catch {
      setItems(convertTextToItems(project.notes));
    }
  }, [project.id, project.notes]);

  const convertTextToItems = (text: string): ProjectChecklistItem[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, idx) => ({
        id: `chk-${Date.now()}-${idx}`,
        text: line.replace(/^[-*•]\s*/, ''),
        completed: false,
        priority: 'normal',
        created_at: new Date().toISOString(),
      }));
  };

  const persistItems = async (newItems: ProjectChecklistItem[]) => {
    setItems(newItems);
    try {
      const notesJson = JSON.stringify(newItems);
      await api.updateProject(project.id, {
        notes: notesJson,
      });
      onProjectUpdated({ ...project, notes: notesJson });
    } catch (err) {
      console.error('Failed to save project checklist:', err);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newItem: ProjectChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: inputText.trim(),
      completed: false,
      priority: inputPriority,
      created_at: new Date().toISOString(),
    };

    const updated = [newItem, ...items];
    persistItems(updated);
    setInputText('');
  };

  const handleToggleItem = (id: string) => {
    const updated = items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    persistItems(updated);
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    persistItems(updated);
  };

  const handleClearCompleted = () => {
    const updated = items.filter(item => !item.completed);
    persistItems(updated);
  };

  const totalCount = items.length;
  const completedCount = items.filter(i => i.completed).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredItems = items.filter(item => {
    if (filter === 'active') return !item.completed;
    if (filter === 'completed') return item.completed;
    return true;
  });

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Summary & Progress Card */}
      <div
        style={{
          backgroundColor: '#0c0b16',
          border: '1px solid rgba(139, 92, 246, 0.18)',
          borderRadius: 12,
          padding: '18px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>
              {isRu ? 'Чеклист и задачи проекта' : 'Project Checklist & Tasks'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {isRu
                ? 'Быстрые пункты и заметки, которые можно отмечать по мере готовности.'
                : 'Actionable todo items and sprint notes directly linked to this project.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc' }}>
              {completedCount}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              / {totalCount} {isRu ? 'готово' : 'done'}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, marginLeft: 8 }}>
              ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Minimal Progress Bar */}
        <div
          style={{
            width: '100%',
            height: 5,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: '#8b5cf6',
              transition: 'width 0.25s ease',
            }}
          />
        </div>
      </div>

      {/* Input Form for new checklist items */}
      <form
        onSubmit={handleAddItem}
        style={{
          display: 'flex',
          gap: 10,
          backgroundColor: '#0c0b16',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: 10,
          padding: 8,
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder={isRu ? '+ Добавить пункт чеклиста (Enter для сохранения)...' : '+ Add checklist item (Press Enter)...'}
          style={{
            flex: 1,
            height: 38,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '0.88rem',
            padding: '0 12px',
          }}
        />

        {/* Priority select pill */}
        <select
          value={inputPriority}
          onChange={e => setInputPriority(e.target.value as any)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 6,
            color: 'var(--text-muted)',
            fontSize: '0.78rem',
            height: 34,
            padding: '0 8px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="normal">{isRu ? 'Обычный' : 'Normal'}</option>
          <option value="high">{isRu ? 'Высокий' : 'High'}</option>
          <option value="low">{isRu ? 'Низкий' : 'Low'}</option>
        </select>

        <button
          type="submit"
          className="btn btn-primary"
          style={{
            height: 34,
            padding: '0 16px',
            fontSize: '0.82rem',
            gap: 6,
          }}
          disabled={!inputText.trim()}
        >
          <Plus size={14} />
          <span>{isRu ? 'Добавить' : 'Add'}</span>
        </button>
      </form>

      {/* Filter and action tools */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filter === 'all' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
              backgroundColor: filter === 'all' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              color: filter === 'all' ? '#fff' : 'var(--text-dim)',
            }}
          >
            {isRu ? 'Все' : 'All'} ({totalCount})
          </button>
          <button
            onClick={() => setFilter('active')}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filter === 'active' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
              backgroundColor: filter === 'active' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              color: filter === 'active' ? '#fff' : 'var(--text-dim)',
            }}
          >
            {isRu ? 'В работе' : 'Active'} ({totalCount - completedCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filter === 'completed' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
              backgroundColor: filter === 'completed' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              color: filter === 'completed' ? '#fff' : 'var(--text-dim)',
            }}
          >
            {isRu ? 'Выполненные' : 'Completed'} ({completedCount})
          </button>
        </div>

        {completedCount > 0 && (
          <button
            onClick={handleClearCompleted}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Trash2 size={12} />
            <span>{isRu ? 'Удалить выполненные' : 'Clear completed'}</span>
          </button>
        )}
      </div>

      {/* Checklist items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
              borderRadius: 10,
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              color: 'var(--text-dim)',
              fontSize: '0.84rem',
            }}
          >
            {isRu ? 'В этой категории пока нет пунктов.' : 'No items in this filter.'}
          </div>
        ) : (
          filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => handleToggleItem(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: item.completed ? '#0a0912' : '#0e0d18',
                border: item.completed
                  ? '1px solid rgba(255, 255, 255, 0.04)'
                  : '1px solid rgba(139, 92, 246, 0.16)',
                borderRadius: 9,
                cursor: 'pointer',
                gap: 12,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!item.completed) {
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.35)';
                  e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.06)';
                }
              }}
              onMouseLeave={e => {
                if (!item.completed) {
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.16)';
                  e.currentTarget.style.backgroundColor = '#0e0d18';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                {item.completed ? (
                  <CheckCircle2 size={18} color="#8b5cf6" style={{ flexShrink: 0 }} />
                ) : (
                  <Circle size={18} color="rgba(255, 255, 255, 0.3)" style={{ flexShrink: 0 }} />
                )}

                <span
                  style={{
                    fontSize: '0.88rem',
                    color: item.completed ? 'var(--text-dim)' : '#f8fafc',
                    textDecoration: item.completed ? 'line-through' : 'none',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}
                >
                  {item.text}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {item.priority === 'high' && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                    }}
                  >
                    {isRu ? 'Высокий' : 'High'}
                  </span>
                )}

                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteItem(item.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                  title={isRu ? 'Удалить' : 'Delete'}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
