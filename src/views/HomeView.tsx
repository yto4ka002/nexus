import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Rocket,
  Plus,
  Code2,
  GitBranch,
  Circle,
  Activity,
  Trash2,
  Edit2,
  Layers,
  Sparkles,
  Link2,
  FileCode,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import * as api from '../api';
import type { Project, Task, LauncherItem } from '../types';
import { GitHubModal } from '../components/projects/GitHubModal';
import { GithubIcon } from '../components/GithubIcon';

export const HomeView: React.FC = () => {
  const {
    systemStats,
    setActiveSection,
    setSelectedProjectId,
    addToast,
    language,
    showConfirm,
  } = useApp();

  const isRu = language === 'ru';
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [launchers, setLaunchers] = useState<LauncherItem[]>([]);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);

  // Quick Launch Modal / Form state
  const [isLauncherModalOpen, setIsLauncherModalOpen] = useState(false);
  const [editingLauncher, setEditingLauncher] = useState<LauncherItem | null>(null);
  const [launcherTitle, setLauncherTitle] = useState('');
  const [launcherType, setLauncherType] = useState<'project' | 'url' | 'file'>('project');
  const [launcherTarget, setLauncherTarget] = useState('');
  const [launcherProjectId, setLauncherProjectId] = useState<number | null>(null);

  // Quick Create Project Modal
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pList, tList, lList] = await Promise.all([
        api.getProjects(),
        api.getTasks(),
        api.getLauncherItems(),
      ]);
      setProjects(pList);
      setTasks(tList.filter(t => t.status !== 'Done').slice(0, 6));
      setLaunchers(lList);
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

  // Quick Launch Handlers
  const handleRunLauncher = async (item: LauncherItem) => {
    if (item.item_type === 'project') {
      const pId = item.project_id || parseInt(item.target_path, 10);
      if (pId && !isNaN(pId)) {
        handleOpenProject(pId);
        addToast(isRu ? 'Проект открыт' : 'Project opened', item.title, 'info');
      } else {
        setActiveSection('projects');
      }
    } else {
      try {
        await api.launchTarget(item.target_path);
        addToast(isRu ? 'Запуск...' : 'Launching...', item.title, 'info');
      } catch (err: any) {
        addToast(isRu ? 'Ошибка запуска' : 'Launch error', String(err), 'error');
      }
    }
  };

  const handleOpenLauncherModal = (item?: LauncherItem) => {
    if (item) {
      setEditingLauncher(item);
      setLauncherTitle(item.title);
      setLauncherType(item.item_type === 'project' ? 'project' : (item.item_type === 'url' ? 'url' : 'file'));
      setLauncherTarget(item.target_path);
      setLauncherProjectId(item.project_id || null);
    } else {
      setEditingLauncher(null);
      setLauncherTitle('');
      setLauncherType('project');
      setLauncherTarget('');
      setLauncherProjectId(projects.length > 0 ? projects[0].id : null);
    }
    setIsLauncherModalOpen(true);
  };

  const handleSaveLauncher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!launcherTitle.trim()) return;

    let targetPath = launcherTarget.trim();
    if (launcherType === 'project') {
      targetPath = String(launcherProjectId || '');
    }

    try {
      if (editingLauncher) {
        await api.updateLauncherItem(editingLauncher.id, {
          title: launcherTitle.trim(),
          item_type: launcherType as any,
          target_path: targetPath,
        });
        addToast(isRu ? 'Ярлык обновлен' : 'Shortcut updated', launcherTitle, 'success');
      } else {
        await api.createLauncherItem({
          title: launcherTitle.trim(),
          item_type: launcherType as any,
          target_path: targetPath,
          icon: launcherType === 'project' ? 'Folder' : (launcherType === 'url' ? 'Globe' : 'File'),
          is_favorite: true,
          sort_order: launchers.length + 1,
        });
        addToast(isRu ? 'Ярлык добавлен' : 'Shortcut added', launcherTitle, 'success');
      }
      setIsLauncherModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(isRu ? 'Ошибка сохранения' : 'Save error', String(err), 'error');
    }
  };

  const handleDeleteLauncher = (item: LauncherItem, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      isRu ? 'Удалить ярлык?' : 'Delete shortcut?',
      item.title,
      async () => {
        await api.deleteLauncherItem(item.id);
        addToast(isRu ? 'Ярлык удален' : 'Shortcut deleted', item.title, 'info');
        loadData();
      },
      true
    );
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
        cover_color: '#8b5cf6',
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
    <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 40, display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* 1. Header / Welcome Ribbon */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid rgba(139, 92, 246, 0.12)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c084fc', fontSize: '0.76rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            <Sparkles size={13} />
            <span>{isRu ? 'Рабочее пространство проектов' : 'Project Workspace Hub'}</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginTop: 4, letterSpacing: -0.5 }}>
            {isRu ? 'Центр управления NEXUS' : 'NEXUS Command Center'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: 2 }}>
            {isRu
              ? `${projects.length} проектов в работе • ${tasks.length} открытых задач`
              : `${projects.length} active projects • ${tasks.length} pending tasks`}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setIsGitHubModalOpen(true)}
            className="btn btn-secondary"
            style={{
              height: 38,
              padding: '0 16px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderColor: 'rgba(139, 92, 246, 0.3)',
            }}
          >
            <GithubIcon size={16} color="#c084fc" />
            <span>GitHub</span>
          </button>

          <button
            onClick={() => setIsCreateProjectOpen(true)}
            className="btn btn-primary"
            style={{
              height: 38,
              padding: '0 18px',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Plus size={16} />
            <span>{isRu ? 'Новый проект' : 'New Project'}</span>
          </button>
        </div>
      </div>

      {/* 2. Quick Launch Hub (Быстрый запуск) */}
      <div
        style={{
          backgroundColor: '#0c0b14',
          border: '1px solid rgba(139, 92, 246, 0.16)',
          borderRadius: 12,
          padding: '18px 22px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Rocket size={17} color="#a855f7" />
            <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#fff' }}>
              {isRu ? 'Быстрый запуск' : 'Quick Launch'}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
              ({launchers.length})
            </span>
          </div>

          <button
            onClick={() => handleOpenLauncherModal()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              color: '#c084fc',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.15)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Plus size={13} />
            <span>{isRu ? 'Добавить ярлык' : 'Add Shortcut'}</span>
          </button>
        </div>

        {launchers.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
              borderRadius: 8,
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              color: 'var(--text-dim)',
              fontSize: '0.84rem',
            }}
          >
            <span>{isRu ? 'Нет настроенных ярлыков. Добавьте проекты, веб-ссылки или файлы для быстрого запуска в 1 клик.' : 'No shortcuts yet. Add your favorite projects, links, or apps.'}</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
            {launchers.map(item => {
              const isProject = item.item_type === 'project';
              const isUrl = item.item_type === 'url';
              return (
                <div
                  key={item.id}
                  onClick={() => handleRunLauncher(item)}
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#11101c',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 9,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                    e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.backgroundColor = '#11101c';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 7,
                        backgroundColor: isProject
                          ? 'rgba(139, 92, 246, 0.18)'
                          : isUrl
                          ? 'rgba(56, 189, 248, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isProject ? '#c084fc' : isUrl ? '#38bdf8' : '#fbbf24',
                        flexShrink: 0,
                      }}
                    >
                      {isProject ? <FolderKanban size={16} /> : isUrl ? <Link2 size={16} /> : <FileCode size={16} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        {isProject ? (isRu ? 'Проект' : 'Project') : isUrl ? 'URL' : (isRu ? 'Файл' : 'File')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenLauncherModal(item);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      title={isRu ? 'Изменить' : 'Edit'}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={e => handleDeleteLauncher(item, e)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      title={isRu ? 'Удалить' : 'Delete'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Projects Grid Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderKanban size={18} color="#c084fc" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
              {isRu ? 'Ваши проекты' : 'Your Projects'}
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              ({projects.length})
            </span>
          </div>

          <button
            onClick={() => setActiveSection('projects')}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.78rem', gap: 6 }}
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
              backgroundColor: '#0c0b14',
              borderRadius: 12,
              border: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <FolderKanban size={36} color="var(--text-dim)" />
            <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#fff' }}>
              {isRu ? 'У вас пока нет проектов' : 'No projects yet'}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 420 }}>
              {isRu
                ? 'Создайте новый локальный проект для работы или загрузите готовый репозиторий с GitHub.'
                : 'Create a local project or import an existing repository from GitHub.'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setIsGitHubModalOpen(true)} className="btn btn-secondary btn-sm">
                <GithubIcon size={14} color="#c084fc" />
                <span>{isRu ? 'Загрузить с GitHub' : 'Import from GitHub'}</span>
              </button>
              <button onClick={() => setIsCreateProjectOpen(true)} className="btn btn-primary btn-sm">
                <Plus size={14} />
                <span>{isRu ? 'Создать проект' : 'Create Project'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => handleOpenProject(p.id)}
                style={{
                  backgroundColor: '#0d0c16',
                  border: '1px solid rgba(139, 92, 246, 0.15)',
                  borderRadius: 11,
                  padding: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  transition: 'all 0.18s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.45)';
                  e.currentTarget.style.backgroundColor = '#121020';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.15)';
                  e.currentTarget.style.backgroundColor = '#0d0c16';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {/* Accent top stripe */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    backgroundColor: p.cover_color || '#8b5cf6',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>
                      {p.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        marginTop: 4,
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
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 5,
                      backgroundColor: 'rgba(139, 92, 246, 0.15)',
                      color: '#c084fc',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-dim)' }}>{isRu ? 'Прогресс' : 'Progress'}</span>
                    <strong style={{ color: '#fff' }}>{p.progress}%</strong>
                  </div>
                  <div style={{ width: '100%', height: 4, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${p.progress}%`,
                        height: '100%',
                        backgroundColor: p.cover_color || '#8b5cf6',
                      }}
                    />
                  </div>
                </div>

                {/* Quick tab jumps */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', gap: 8, fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                    {p.git_remote && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#818cf8' }}>
                        <GitBranch size={12} /> Git
                      </span>
                    )}
                    {p.code_files && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#38bdf8' }}>
                        <Code2 size={12} /> {isRu ? 'Код' : 'Code'}
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: '0.76rem', color: '#c084fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isRu ? 'Открыть' : 'Open'} <ArrowUpRight size={13} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Bottom Split: Urgent Tasks & Hardware Monitoring */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Urgent Project Tasks */}
        <div
          style={{
            backgroundColor: '#0c0b14',
            border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: 12,
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={17} color="#a855f7" />
              <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#fff' }}>
                {isRu ? 'Ближайшие задачи' : 'Pending Tasks'}
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
              {tasks.length} {isRu ? 'в очереди' : 'queued'}
            </span>
          </div>

          {tasks.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
              {isRu ? 'Все задачи выполнены! Отличная работа.' : 'No pending tasks! All done.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.map(t => (
                <div
                  key={t.id}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div
                    onClick={() => handleToggleTask(t)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 0 }}
                  >
                    <Circle size={15} color="var(--text-dim)" />
                    <span
                      style={{
                        fontSize: '0.82rem',
                        color: '#fff',
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
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor:
                        t.priority === 'Critical'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : t.priority === 'High'
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(255, 255, 255, 0.06)',
                      color:
                        t.priority === 'Critical'
                          ? '#ef4444'
                          : t.priority === 'High'
                          ? '#f59e0b'
                          : 'var(--text-dim)',
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
              backgroundColor: '#0c0b14',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: 12,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={17} color="#38bdf8" />
              <span style={{ fontSize: '0.94rem', fontWeight: 700, color: '#fff' }}>
                {isRu ? 'Системные ресурсы' : 'Hardware Telemetry'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* CPU */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>CPU: {systemStats.cpu_name.slice(0, 24)}...</span>
                  <strong style={{ color: '#c084fc' }}>{systemStats.cpu_overall_percent}%</strong>
                </div>
                <div style={{ width: '100%', height: 4, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${systemStats.cpu_overall_percent}%`, height: '100%', backgroundColor: '#c084fc' }} />
                </div>
              </div>

              {/* RAM */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    RAM: {(systemStats.ram_used_mb / 1024).toFixed(1)} / {(systemStats.ram_total_mb / 1024).toFixed(1)} GB
                  </span>
                  <strong style={{ color: '#818cf8' }}>{systemStats.ram_percent}%</strong>
                </div>
                <div style={{ width: '100%', height: 4, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${systemStats.ram_percent}%`, height: '100%', backgroundColor: '#818cf8' }} />
                </div>
              </div>

              {/* Disk */}
              {systemStats.disks.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Disk {systemStats.disks[0].mount_point} ({systemStats.disks[0].available_gb} GB {isRu ? 'свободно' : 'free'})
                    </span>
                    <strong style={{ color: '#34d399' }}>{systemStats.disks[0].usage_percent}%</strong>
                  </div>
                  <div style={{ width: '100%', height: 4, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${systemStats.disks[0].usage_percent}%`, height: '100%', backgroundColor: '#10b981' }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              Windows 11 &bull; PID Monitoring &bull; NEXUS 1.1 Local Engine
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Configure / Add Quick Launch */}
      {isLauncherModalOpen && (
        <div className="modal-overlay" onClick={() => setIsLauncherModalOpen(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 480,
              backgroundColor: '#0c0b16',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: 12,
              padding: 24,
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>
              {editingLauncher
                ? (isRu ? 'Редактировать быстрый запуск' : 'Edit Quick Launch')
                : (isRu ? 'Настроить быстрый запуск' : 'Add Quick Launch Item')}
            </h3>

            <form onSubmit={handleSaveLauncher} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">{isRu ? 'Название ярлыка' : 'Shortcut Title'}</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder={isRu ? 'Например: KusairaWeb или Figma' : 'e.g. My Project or Figma'}
                  value={launcherTitle}
                  onChange={e => setLauncherTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">{isRu ? 'Тип запуска' : 'Launch Type'}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setLauncherType('project')}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      backgroundColor: launcherType === 'project' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
                      borderColor: launcherType === 'project' ? '#8b5cf6' : 'rgba(255, 255, 255, 0.1)',
                      color: launcherType === 'project' ? '#fff' : 'var(--text-dim)',
                    }}
                  >
                    {isRu ? 'Проект' : 'Project'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLauncherType('url')}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      backgroundColor: launcherType === 'url' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                      borderColor: launcherType === 'url' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                      color: launcherType === 'url' ? '#fff' : 'var(--text-dim)',
                    }}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setLauncherType('file')}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      backgroundColor: launcherType === 'file' ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
                      borderColor: launcherType === 'file' ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                      color: launcherType === 'file' ? '#fff' : 'var(--text-dim)',
                    }}
                  >
                    {isRu ? 'Файл / Путь' : 'File / App'}
                  </button>
                </div>
              </div>

              {launcherType === 'project' ? (
                <div>
                  <label className="form-label">{isRu ? 'Выберите проект' : 'Select Project'}</label>
                  {projects.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {isRu ? 'Сначала создайте проект.' : 'No projects available.'}
                    </div>
                  ) : (
                    <select
                      className="form-input"
                      value={launcherProjectId || ''}
                      onChange={e => setLauncherProjectId(Number(e.target.value))}
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div>
                  <label className="form-label">
                    {launcherType === 'url' ? (isRu ? 'Веб-адрес' : 'URL Link') : (isRu ? 'Путь к файлу или программе' : 'File or App Path')}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder={
                      launcherType === 'url'
                        ? 'https://github.com/yto4ka002/KusairaWeb'
                        : 'C:\\Program Files\\VSCode\\Code.exe'
                    }
                    value={launcherTarget}
                    onChange={e => setLauncherTarget(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsLauncherModalOpen(false)}
                >
                  {isRu ? 'Отмена' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {isRu ? 'Сохранить ярлык' : 'Save Shortcut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Local Project */}
      {isCreateProjectOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateProjectOpen(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 480,
              backgroundColor: '#0c0b16',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: 12,
              padding: 24,
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>
              {isRu ? 'Создать новый проект' : 'Create New Project'}
            </h3>

            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">{isRu ? 'Название проекта' : 'Project Title'}</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder={isRu ? 'Например: KusairaWeb Frontend' : 'e.g. Mobile App'}
                  value={newProjectTitle}
                  onChange={e => setNewProjectTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">{isRu ? 'Описание проекта' : 'Description'}</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder={isRu ? 'Краткое описание целей и стека...' : 'Brief description...'}
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsCreateProjectOpen(false)}
                >
                  {isRu ? 'Отмена' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
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
