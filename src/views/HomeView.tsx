import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Code2,
  GitBranch,
  Circle,
  Activity,
  Layers,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import * as api from '../api';
import type { Project, Task } from '../types';
import { GitHubModal } from '../components/projects/GitHubModal';
import { GithubIcon } from '../components/GithubIcon';

export const HomeView: React.FC = () => {
  const {
    systemStats,
    setActiveSection,
    setSelectedProjectId,
    addToast,
    language,
  } = useApp();

  const isRu = language === 'ru';
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);

  // Quick Create Project Modal
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pList, tList] = await Promise.all([
        api.getProjects(),
        api.getTasks(),
      ]);
      setProjects(pList);
      setTasks(tList.filter(t => t.status !== 'Done').slice(0, 8));
    } catch (err) {
      console.error('Failed to load home data', err);
    }
  };

  const handleOpenProject = (id: number) => {
    setSelectedProjectId(id);
    setActiveSection('projects');
  };

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === 'Done' ? 'To Do' : 'Done';
    await api.updateTask(task.id, { status: newStatus });
    addToast(
      isRu ? 'Задача обновлена' : 'Task updated',
      task.title,
      'success'
    );
    loadData();
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    try {
      const created = await api.createProject({
        title: newProjectTitle.trim(),
        description: newProjectDesc.trim(),
        status: 'Planning',
        progress: 0,
        cover_color: '#8B6CFF',
      });
      addToast(isRu ? 'Проект создан' : 'Project created', created.title, 'success');
      setIsCreateProjectOpen(false);
      setNewProjectTitle('');
      setNewProjectDesc('');
      loadData();
      handleOpenProject(created.id);
    } catch (err: any) {
      addToast(isRu ? 'Ошибка' : 'Error', String(err), 'error');
    }
  };

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '8px 12px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* 1. Header / Welcome Ribbon */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 20px',
          backgroundColor: '#111115',
          border: '1px solid #25252D',
          borderRadius: 8,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#8B6CFF',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            <Sparkles size={13} />
            <span>{isRu ? 'Рабочее пространство проектов' : 'Project Workspace Hub'}</span>
          </div>
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#F1F1F5',
              margin: '6px 0 2px',
              letterSpacing: -0.5,
            }}
          >
            {isRu ? 'Центр управления NEXUS' : 'NEXUS Command Center'}
          </h1>
          <p style={{ color: '#92929F', fontSize: '0.82rem', margin: 0 }}>
            {isRu
              ? `${projects.length} проектов в работе • ${tasks.length} открытых задач`
              : `${projects.length} active projects • ${tasks.length} pending tasks`}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setIsGitHubModalOpen(true)}
            style={{
              height: 36,
              padding: '0 16px',
              fontSize: '0.8rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              borderRadius: 6,
              color: '#F1F1F5',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
          >
            <GithubIcon size={15} color="#A78BFA" />
            <span>GitHub</span>
          </button>

          <button
            onClick={() => setIsCreateProjectOpen(true)}
            style={{
              height: 36,
              padding: '0 18px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              backgroundColor: '#8B6CFF',
              border: 'none',
              borderRadius: 6,
              color: '#0B0B0E',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
          >
            <Plus size={15} />
            <span>{isRu ? 'Новый проект' : 'New Project'}</span>
          </button>
        </div>
      </div>

      {/* 2. Projects Grid Section */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderKanban size={17} color="#8B6CFF" />
            <h2 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#F1F1F5', margin: 0 }}>
              {isRu ? 'Ваши проекты' : 'Your Projects'}
            </h2>
            <span style={{ fontSize: '0.74rem', color: '#686877' }}>
              ({projects.length})
            </span>
          </div>

          <button
            onClick={() => setActiveSection('projects')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
              border: '1px solid #25252D',
              padding: '4px 10px',
              borderRadius: 5,
              color: '#A78BFA',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
          >
            <span>{isRu ? 'Все проекты' : 'View All'}</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        {projects.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: '#111115',
              borderRadius: 8,
              border: '1px solid #25252D',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <FolderKanban size={36} color="#686877" />
            <div style={{ fontSize: '0.94rem', fontWeight: 600, color: '#F1F1F5' }}>
              {isRu ? 'У вас пока нет проектов' : 'No projects yet'}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#92929F', maxWidth: 420, margin: 0 }}>
              {isRu
                ? 'Создайте новый локальный проект для работы или загрузите готовый репозиторий с GitHub.'
                : 'Create a local project or import an existing repository from GitHub.'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => setIsGitHubModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  backgroundColor: '#16161C',
                  border: '1px solid #25252D',
                  borderRadius: 5,
                  color: '#F1F1F5',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                }}
              >
                <GithubIcon size={14} color="#A78BFA" />
                <span>{isRu ? 'Загрузить с GitHub' : 'Import from GitHub'}</span>
              </button>
              <button
                onClick={() => setIsCreateProjectOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 16px',
                  backgroundColor: '#8B6CFF',
                  border: 'none',
                  borderRadius: 5,
                  color: '#0B0B0E',
                  fontWeight: 600,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>{isRu ? 'Создать проект' : 'Create Project'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 14,
            }}
          >
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => handleOpenProject(p.id)}
                style={{
                  backgroundColor: '#111115',
                  border: '1px solid #25252D',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(139, 108, 255, 0.45)';
                  e.currentTarget.style.backgroundColor = '#16161C';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#25252D';
                  e.currentTarget.style.backgroundColor = '#111115';
                }}
              >
                {/* Accent top stripe */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    backgroundColor: p.cover_color || '#8B6CFF',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: '0.96rem',
                        fontWeight: 700,
                        color: '#F1F1F5',
                        margin: 0,
                        letterSpacing: -0.2,
                      }}
                    >
                      {p.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.76rem',
                        color: '#92929F',
                        marginTop: 4,
                        marginBottom: 0,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {p.description || (isRu ? 'Нет описания' : 'No description')}
                    </p>
                  </div>

                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(139, 108, 255, 0.12)',
                      color: '#A78BFA',
                      border: '1px solid rgba(139, 108, 255, 0.25)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: '#686877' }}>{isRu ? 'Прогресс' : 'Progress'}</span>
                    <strong style={{ color: '#F1F1F5' }}>{p.progress}%</strong>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 4,
                      backgroundColor: '#16161C',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${p.progress}%`,
                        height: '100%',
                        backgroundColor: p.cover_color || '#8B6CFF',
                      }}
                    />
                  </div>
                </div>

                {/* Quick tab jumps */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid #25252D',
                    paddingTop: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      fontSize: '0.7rem',
                      color: '#686877',
                    }}
                  >
                    {p.git_remote && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#A78BFA' }}>
                        <GitBranch size={12} /> Git
                      </span>
                    )}
                    {p.code_files && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#92929F' }}>
                        <Code2 size={12} /> {isRu ? 'Код' : 'Code'}
                      </span>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#8B6CFF',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    {isRu ? 'Открыть' : 'Open'} <ArrowUpRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Bottom Split: Urgent Tasks & Hardware Monitoring */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
        }}
      >
        {/* Urgent Project Tasks */}
        <div
          style={{
            backgroundColor: '#111115',
            border: '1px solid #25252D',
            borderRadius: 8,
            padding: '16px 18px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="#8B6CFF" />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F1F5' }}>
                {isRu ? 'Ближайшие задачи' : 'Pending Tasks'}
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#686877' }}>
              {tasks.length} {isRu ? 'в очереди' : 'queued'}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div
              style={{
                padding: '24px 0',
                textAlign: 'center',
                color: '#686877',
                fontSize: '0.78rem',
              }}
            >
              {isRu ? 'Все задачи выполнены! Отличная работа.' : 'No pending tasks! All done.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map(t => (
                <div
                  key={t.id}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div
                    onClick={() => handleToggleTask(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Circle size={14} color="#686877" />
                    <span
                      style={{
                        fontSize: '0.78rem',
                        color: '#F1F1F5',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.title}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 3,
                      backgroundColor:
                        t.priority === 'Critical'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : t.priority === 'High'
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(255, 255, 255, 0.05)',
                      color:
                        t.priority === 'Critical'
                          ? '#ef4444'
                          : t.priority === 'High'
                          ? '#f59e0b'
                          : '#92929F',
                    }}
                  >
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Minimal Hardware Monitoring */}
        {systemStats && (
          <div
            style={{
              backgroundColor: '#111115',
              border: '1px solid #25252D',
              borderRadius: 8,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="#8B6CFF" />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F1F5' }}>
                {isRu ? 'Системные ресурсы' : 'Hardware Telemetry'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* CPU */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: '#92929F' }}>
                    CPU: {systemStats.cpu_name ? systemStats.cpu_name.slice(0, 24) : 'Processor'}...
                  </span>
                  <strong style={{ color: '#A78BFA' }}>{systemStats.cpu_overall_percent}%</strong>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    backgroundColor: '#16161C',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${systemStats.cpu_overall_percent}%`,
                      height: '100%',
                      backgroundColor: '#8B6CFF',
                    }}
                  />
                </div>
              </div>

              {/* RAM */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: '#92929F' }}>
                    RAM: {(systemStats.ram_used_mb / 1024).toFixed(1)} / {(systemStats.ram_total_mb / 1024).toFixed(1)} GB
                  </span>
                  <strong style={{ color: '#A78BFA' }}>{systemStats.ram_percent}%</strong>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 4,
                    backgroundColor: '#16161C',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${systemStats.ram_percent}%`,
                      height: '100%',
                      backgroundColor: '#8B6CFF',
                    }}
                  />
                </div>
              </div>

              {/* Disk */}
              {systemStats.disks && systemStats.disks.length > 0 && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.74rem',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: '#92929F' }}>
                      Disk {systemStats.disks[0].mount_point} ({systemStats.disks[0].available_gb} GB {isRu ? 'свободно' : 'free'})
                    </span>
                    <strong style={{ color: '#10b981' }}>{systemStats.disks[0].usage_percent}%</strong>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 4,
                      backgroundColor: '#16161C',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${systemStats.disks[0].usage_percent}%`,
                        height: '100%',
                        backgroundColor: '#10b981',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.68rem', color: '#686877' }}>
              Windows 11 &bull; PID Monitoring &bull; NEXUS 1.1 Local Engine
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Create Local Project */}
      {isCreateProjectOpen && (
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
          onClick={() => setIsCreateProjectOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              backgroundColor: '#111115',
              border: '1px solid #25252D',
              borderRadius: 8,
              padding: 20,
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F1F5', margin: '0 0 16px' }}>
              {isRu ? 'Создать новый проект' : 'Create New Project'}
            </h3>

            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: '#92929F', marginBottom: 5 }}>
                  {isRu ? 'Название проекта' : 'Project Title'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={isRu ? 'Например: KusairaWeb Frontend' : 'e.g. Mobile App'}
                  value={newProjectTitle}
                  onChange={e => setNewProjectTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 5,
                    color: '#F1F1F5',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: '#92929F', marginBottom: 5 }}>
                  {isRu ? 'Описание проекта' : 'Description'}
                </label>
                <textarea
                  rows={3}
                  placeholder={isRu ? 'Краткое описание целей и стека...' : 'Brief description...'}
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 5,
                    color: '#F1F1F5',
                    fontSize: '0.8rem',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setIsCreateProjectOpen(false)}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: 'transparent',
                    border: '1px solid #25252D',
                    borderRadius: 5,
                    color: '#92929F',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                  }}
                >
                  {isRu ? 'Отмена' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '6px 18px',
                    backgroundColor: '#8B6CFF',
                    border: 'none',
                    borderRadius: 5,
                    color: '#0B0B0E',
                    fontWeight: 600,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                  }}
                >
                  {isRu ? 'Создать проект' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global GitHub Import Modal */}
      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        onProjectImported={project => {
          loadData();
          handleOpenProject(project.id);
        }}
      />
    </div>
  );
};
