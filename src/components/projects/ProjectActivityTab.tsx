import React, { useState, useEffect } from 'react';
import {
  Activity,
  FileCode,
  GitBranch,
  Bot,
  ShieldCheck,
  Terminal,
  Clock,
  RefreshCw,
} from 'lucide-react';
import * as api from '../../api';
import type { Project } from '../../types';

interface ProjectActivityTabProps {
  project: Project;
  isRu: boolean;
}

export const ProjectActivityTab: React.FC<ProjectActivityTabProps> = ({ project, isRu }) => {
  const [activities, setActivities] = useState<api.ActivityRecord[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [project.id]);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const list = await api.getActivities(project.id);
      setActivities(list);
    } catch {
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = activities.filter(a => (filterType === 'all' ? true : a.event_type === filterType));

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'file_edit':
        return <FileCode size={16} color="#A78BFA" />;
      case 'git_commit':
      case 'git_push':
        return <GitBranch size={16} color="#10b981" />;
      case 'ai_action':
        return <Bot size={16} color="#8B6CFF" />;
      case 'checkpoint':
        return <ShieldCheck size={16} color="#f59e0b" />;
      case 'terminal':
        return <Terminal size={16} color="#06b6d4" />;
      default:
        return <Activity size={16} color="#92929F" />;
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'file_edit':
        return { label: isRu ? 'Файлы' : 'Files', color: '#A78BFA' };
      case 'git_commit':
        return { label: 'Git Commit', color: '#10b981' };
      case 'git_push':
        return { label: 'Git Push', color: '#10b981' };
      case 'ai_action':
        return { label: 'AI Agent', color: '#8B6CFF' };
      case 'checkpoint':
        return { label: isRu ? 'Чекпоинт' : 'Checkpoint', color: '#f59e0b' };
      case 'terminal':
        return { label: isRu ? 'Терминал' : 'Terminal', color: '#06b6d4' };
      default:
        return { label: type, color: '#92929F' };
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        backgroundColor: '#0B0B0E',
        overflow: 'hidden',
      }}
    >
      {/* Top Filter Bar */}
      <div
        style={{
          padding: '12px 18px',
          backgroundColor: '#111115',
          borderBottom: '1px solid #25252D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
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
            <Activity size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#F1F1F5' }}>
              {isRu ? 'Журнал Активности Проекта' : 'Project Activity Log'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#92929F' }}>
              {isRu
                ? 'История изменений файлов, коммитов Git, работы AI и запусков команд'
                : 'Audit feed of file edits, commits, AI operations and terminal events'}
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[
            { id: 'all', label: isRu ? 'Все' : 'All' },
            { id: 'file_edit', label: isRu ? 'Файлы' : 'Files' },
            { id: 'ai_action', label: 'AI' },
            { id: 'git_commit', label: 'Git' },
            { id: 'checkpoint', label: isRu ? 'Чекпоинты' : 'Checkpoints' },
            { id: 'terminal', label: isRu ? 'Терминал' : 'Terminal' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setFilterType(btn.id)}
              style={{
                padding: '4px 9px',
                borderRadius: 4,
                border: filterType === btn.id ? '1px solid rgba(139, 108, 255, 0.4)' : '1px solid #25252D',
                backgroundColor: filterType === btn.id ? 'rgba(139, 108, 255, 0.15)' : '#16161C',
                color: filterType === btn.id ? '#F1F1F5' : '#92929F',
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
            >
              {btn.label}
            </button>
          ))}

          <button
            onClick={loadActivities}
            style={{
              padding: '5px 8px',
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              borderRadius: 4,
              color: '#92929F',
              cursor: 'pointer',
              display: 'flex',
              marginLeft: 4,
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Timeline Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: '#686877',
              fontSize: '0.8rem',
            }}
          >
            {isRu ? 'Событий активности пока нет' : 'No recorded activity yet'}
          </div>
        ) : (
          filtered.map(act => {
            const badge = getEventBadge(act.event_type);
            return (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  backgroundColor: '#111115',
                  border: '1px solid #25252D',
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {getEventIcon(act.event_type)}
                </div>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        padding: '1px 6px',
                        borderRadius: 3,
                        backgroundColor: `${badge.color}15`,
                        color: badge.color,
                        border: `1px solid ${badge.color}30`,
                        fontWeight: 600,
                      }}
                    >
                      {badge.label}
                    </span>

                    <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#F1F1F5' }}>
                      {act.description}
                    </span>
                  </div>

                  {act.metadata && (
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: '#92929F',
                        fontFamily: 'monospace',
                        backgroundColor: '#0B0B0E',
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: '1px solid #25252D',
                        marginTop: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {act.metadata}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: 6,
                      fontSize: '0.67rem',
                      color: '#686877',
                    }}
                  >
                    <Clock size={11} />
                    <span>{new Date(act.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
