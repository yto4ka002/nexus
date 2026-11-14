import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit2,
  Layers,
  ChevronRight,
  ChevronLeft,
  Code,
  Play,
  GitBranch,
  CheckSquare,
  Settings,
  Bot,
  Terminal,
  ShieldCheck,
  Activity,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';
import { useApp } from '../context/AppContext';
import * as api from '../api';
import type { Project, Task, CodeFile, CoworkingData, ProjectTemplate } from '../types';
import { CodeStudioTab } from '../components/projects/CodeStudioTab';
import { LivePreviewTab } from '../components/projects/LivePreviewTab';
import { GitControlTab } from '../components/projects/GitControlTab';
import { ProjectChecklistTab } from '../components/projects/ProjectChecklistTab';
import { ProjectTerminalTab } from '../components/projects/ProjectTerminalTab';
import { AIAgentTab } from '../components/projects/AIAgentTab';
import { ProjectDocsTab } from '../components/projects/ProjectDocsTab';
import { ProjectCheckpointsTab } from '../components/projects/ProjectCheckpointsTab';
import { ProjectActivityTab } from '../components/projects/ProjectActivityTab';
import { GitHubModal } from '../components/projects/GitHubModal';
import { ProjectTemplatesModal } from '../components/projects/ProjectTemplatesModal';

const KANBAN_COLUMNS = ['To Do', 'In Progress', 'Review', 'Done'];

export const ProjectsView: React.FC = () => {
  const { selectedProjectId, setSelectedProjectId, showConfirm, addToast, language } = useApp();
  const isRu = language === 'ru';

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<
    'code' | 'ai' | 'git' | 'terminal' | 'board' | 'checklist' | 'docs' | 'checkpoints' | 'activity' | 'preview' | 'settings'
  >('code');
  const [isGitHubModalOpen, setGitHubModalOpen] = useState(false);
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);

  // Code Studio state
  const [codeFiles, setCodeFiles] = useState<CodeFile[]>([]);
  const [activeCodeFileId, setActiveCodeFileId] = useState<string>('');
  const [coworkingData, setCoworkingData] = useState<CoworkingData>({
    members: [],
    messages: [],
    timeline: [],
    commits: [],
    activeBranch: 'main',
    branches: ['main'],
    scratchpad: '',
  });

  // Modal states
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    cover_color: '#8b5cf6',
    status: 'In Progress',
    progress: 0,
    deadline: '',
  });

  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [taskColumn, setTaskColumn] = useState('To Do');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'Normal' as Task['priority'],
    due_date: '',
  });

  useEffect(() => {
    loadProjects();
  }, [selectedProjectId]);

  const loadProjects = async () => {
    const list = await api.getProjects();
    setProjects(list);

    if (list.length > 0) {
      const target = selectedProjectId
        ? list.find(p => p.id === selectedProjectId) || list[0]
        : list[0];
      selectProject(target);
    } else {
      setActiveProject(null);
    }
  };

  const selectProject = async (p: Project) => {
    setActiveProject(p);
    setSelectedProjectId(p.id);

    // Parse Code Files
    let parsedFiles: CodeFile[] = [];
    try {
      if (p.code_files) {
        parsedFiles = JSON.parse(p.code_files);
      }
    } catch {}

    if (!parsedFiles || parsedFiles.length === 0) {
      parsedFiles = [
        {
          id: 'f-1',
          name: 'index.html',
          path: 'index.html',
          language: 'html',
          content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>' + p.title + '</title>\n</head>\n<body>\n  <h1>' + p.title + '</h1>\n  <p>Created in NEXUS 1.1</p>\n</body>\n</html>',
        },
        {
          id: 'f-2',
          name: 'README.md',
          path: 'README.md',
          language: 'markdown',
          content: '# ' + p.title + '\n\n' + (p.description || 'Project managed in NEXUS.'),
        },
      ];
    }
    setCodeFiles(parsedFiles);
    setActiveCodeFileId(parsedFiles[0]?.id || '');

    // Parse Git / Commits
    let parsedCoworking: CoworkingData = {
      members: [],
      messages: [],
      timeline: [],
      commits: [],
      activeBranch: 'main',
      branches: ['main'],
      scratchpad: '',
    };
    try {
      if (p.coworking_data) {
        parsedCoworking = { ...parsedCoworking, ...JSON.parse(p.coworking_data) };
      }
    } catch {}
    setCoworkingData(parsedCoworking);

    // Load Project Tasks
    try {
      const allTasks = await api.getTasks(p.id);
      setTasks(allTasks);
    } catch {
      setTasks([]);
    }
  };

  const handleCreateProject = () => {
    setEditingProject(null);
    setProjectForm({
      title: '',
      description: '',
      cover_color: '#8b5cf6',
      status: 'In Progress',
      progress: 0,
      deadline: '',
    });
    setProjectModalOpen(true);
  };

  const handleEditProject = (p: Project) => {
    setEditingProject(p);
    setProjectForm({
      title: p.title,
      description: p.description,
      cover_color: p.cover_color,
      status: p.status,
      progress: p.progress,
      deadline: p.deadline || '',
    });
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.title.trim()) return;

    try {
      if (editingProject) {
        await api.updateProject(editingProject.id, projectForm);
        const updated: Project = { ...editingProject, ...projectForm };
        setProjects(prev => prev.map(p => (p.id === updated.id ? updated : p)));
        setActiveProject(updated);
        addToast(isRu ? 'Проект обновлен' : 'Project updated', updated.title, 'success');
      } else {
        const created = await api.createProject(projectForm);
        setProjects(prev => [created, ...prev]);
        selectProject(created);
        addToast(isRu ? 'Проект создан' : 'Project created', created.title, 'success');
      }
      setProjectModalOpen(false);
    } catch (err: any) {
      addToast(isRu ? 'Ошибка' : 'Error', String(err), 'error');
    }
  };

  const handleDeleteProject = (p: Project) => {
    showConfirm(
      isRu ? 'Удалить проект?' : 'Delete Project?',
      isRu
        ? `Вы уверены, что хотите удалить «${p.title}» и все его задачи?`
        : `Are you sure you want to delete "${p.title}"?`,
      async () => {
        await api.deleteProject(p.id);
        addToast(isRu ? 'Проект удален' : 'Project deleted', p.title, 'info');
        const remaining = projects.filter(item => item.id !== p.id);
        setProjects(remaining);
        if (remaining.length > 0) {
          selectProject(remaining[0]);
        } else {
          setActiveProject(null);
          setSelectedProjectId(null);
        }
      },
      true,
      isRu ? 'Удалить' : 'Delete'
    );
  };

  // Kanban Handlers
  const handleOpenAddTask = (column: string) => {
    setTaskColumn(column);
    setTaskForm({
      title: '',
      description: '',
      priority: 'Normal',
      due_date: '',
    });
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !activeProject) return;

    try {
      const taskStatus = taskColumn === 'Done' ? 'Done' : (taskColumn === 'In Progress' ? 'In Progress' : 'To Do');
      const newTask = await api.createTask({
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        priority: taskForm.priority,
        status: taskStatus,
        project_id: activeProject.id,
        kanban_column: taskColumn,
        due_date: taskForm.due_date || undefined,
      });

      setTasks(prev => [...prev, newTask]);
      setTaskModalOpen(false);
      addToast(isRu ? 'Задача добавлена' : 'Task added', newTask.title, 'success');
      recalcProjectProgress();
    } catch (err: any) {
      addToast(isRu ? 'Ошибка' : 'Error', String(err), 'error');
    }
  };

  const handleMoveTaskColumn = async (task: Task, direction: 'prev' | 'next') => {
    const currentIdx = KANBAN_COLUMNS.indexOf(task.kanban_column || 'To Do');
    if (currentIdx === -1) return;

    const newIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (newIdx < 0 || newIdx >= KANBAN_COLUMNS.length) return;

    const newCol = KANBAN_COLUMNS[newIdx];
    const newStatus = newCol === 'Done' ? 'Done' : (newCol === 'In Progress' ? 'In Progress' : 'To Do');

    await api.updateTask(task.id, { kanban_column: newCol, status: newStatus });
    setTasks(prev =>
      prev.map(t => (t.id === task.id ? { ...t, kanban_column: newCol, status: newStatus } : t))
    );
    recalcProjectProgress();
  };

  const handleDeleteTask = async (taskId: number) => {
    await api.deleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    addToast(isRu ? 'Задача удалена' : 'Task deleted', '', 'info');
    recalcProjectProgress();
  };

  const recalcProjectProgress = async () => {
    if (!activeProject) return;
    const currentTasks = await api.getTasks(activeProject.id);
    const total = currentTasks.length;
    const done = currentTasks.filter(t => (t.kanban_column || t.status) === 'Done').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    await api.updateProject(activeProject.id, { progress: pct });
    setActiveProject(prev => (prev ? { ...prev, progress: pct } : null));
    setProjects(prev => prev.map(p => (p.id === activeProject.id ? { ...p, progress: pct } : p)));
  };

  // Code saving
  const handleSaveCodeFiles = async (updatedFiles: CodeFile[]) => {
    if (!activeProject) return;
    setCodeFiles(updatedFiles);
    try {
      const jsonStr = JSON.stringify(updatedFiles);
      await api.updateProject(activeProject.id, {
        code_files: jsonStr,
      });
      setActiveProject(prev => (prev ? { ...prev, code_files: jsonStr } : null));
      addToast(isRu ? 'Код сохранен' : 'Code saved', `${updatedFiles.length} файлов`, 'success');
    } catch (err: any) {
      addToast(isRu ? 'Ошибка сохранения' : 'Save Error', String(err), 'error');
    }
  };

  const handleSelectTemplate = async (template: ProjectTemplate) => {
    if (!activeProject) return;
    const newFiles: CodeFile[] = template.files.map((f, idx) => ({
      id: `f-tmpl-${Date.now()}-${idx}`,
      name: f.name,
      path: f.path,
      language: f.language,
      content: f.content,
    }));
    await handleSaveCodeFiles(newFiles);
    setActiveCodeFileId(newFiles[0]?.id || '');
    addToast(
      isRu ? 'Шаблон применен!' : 'Template Applied!',
      `${template.title} (${newFiles.length} ${isRu ? 'файлов' : 'files'})`,
      'success'
    );
  };

  // Git updating
  const handleUpdateCoworkingData = async (updated: CoworkingData) => {
    if (!activeProject) return;
    setCoworkingData(updated);
    try {
      const jsonStr = JSON.stringify(updated);
      await api.updateProject(activeProject.id, {
        coworking_data: jsonStr,
      });
      setActiveProject(prev => (prev ? { ...prev, coworking_data: jsonStr } : null));
    } catch (err: any) {
      console.error(err);
    }
  };

  const translateColumn = (col: string) => {
    if (!isRu) return col;
    switch (col) {
      case 'To Do': return 'К выполнению';
      case 'In Progress': return 'В процессе';
      case 'Review': return 'На проверке';
      case 'Done': return 'Готово';
      default: return col;
    }
  };

  return (
    <div style={{ maxWidth: 1350, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Projects Switcher Bar (Replaces left sidebar!) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '10px 16px',
          backgroundColor: '#0c0b14',
          border: '1px solid rgba(139, 92, 246, 0.16)',
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', maxWidth: '80%' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginRight: 4 }}>
            {isRu ? 'Проекты:' : 'Projects:'}
          </span>

          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => selectProject(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 12px',
                borderRadius: 7,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                border:
                  activeProject?.id === p.id
                    ? '1px solid rgba(139, 92, 246, 0.45)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                backgroundColor:
                  activeProject?.id === p.id
                    ? 'rgba(139, 92, 246, 0.2)'
                    : 'rgba(255, 255, 255, 0.02)',
                color: activeProject?.id === p.id ? '#fff' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: p.cover_color || '#8b5cf6',
                }}
              />
              <span>{p.title}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setGitHubModalOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.78rem', gap: 6, borderColor: 'rgba(139, 92, 246, 0.3)' }}
          >
            <GithubIcon size={14} color="#c084fc" />
            <span>GitHub</span>
          </button>

          <button
            onClick={handleCreateProject}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '0.78rem', gap: 6 }}
          >
            <Plus size={14} />
            <span>{isRu ? 'Создать' : 'New'}</span>
          </button>
        </div>
      </div>

      {/* When no projects exist */}
      {!activeProject ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: '#0c0b14',
            borderRadius: 12,
            border: '1px solid rgba(139, 92, 246, 0.16)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <FolderKanban size={48} color="#8b5cf6" style={{ opacity: 0.6 }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
            {isRu ? 'Нет активных проектов' : 'No active projects'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', maxWidth: 450 }}>
            {isRu
              ? 'Создайте локальный проект или загрузите репозиторий с вашего GitHub аккаунта.'
              : 'Create a new local project or import a repository from your GitHub account.'}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={() => setGitHubModalOpen(true)} className="btn btn-secondary">
              <GithubIcon size={16} color="#c084fc" />
              <span>{isRu ? 'Загрузить с GitHub' : 'Import from GitHub'}</span>
            </button>
            <button onClick={handleCreateProject} className="btn btn-primary">
              <Plus size={16} />
              <span>{isRu ? 'Создать проект' : 'Create Project'}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. Active Project Header & Focused Tab Pills */}
          <div
            style={{
              backgroundColor: '#0c0b14',
              border: '1px solid rgba(139, 92, 246, 0.16)',
              borderRadius: 11,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>
                    {activeProject.title}
                  </h2>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 5,
                      backgroundColor: 'rgba(139, 92, 246, 0.18)',
                      color: '#c084fc',
                    }}
                  >
                    {activeProject.status}
                  </span>
                </div>
                {activeProject.description && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                    {activeProject.description}
                  </p>
                )}
              </div>

              {/* Progress & Quick Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginRight: 6 }}>
                  <div style={{ fontSize: '0.74rem', color: '#92929F' }}>
                    {isRu ? 'Прогресс' : 'Progress'}: <strong style={{ color: '#F1F1F5' }}>{activeProject.progress}%</strong>
                  </div>
                  <div style={{ width: 100, height: 4, backgroundColor: '#25252D', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${activeProject.progress}%`, height: '100%', backgroundColor: '#8B6CFF' }} />
                  </div>
                </div>

                <button
                  onClick={() => setTemplateModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 5,
                    color: '#A78BFA',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={13} color="#8B6CFF" />
                  <span>{isRu ? 'Шаблоны' : 'Templates'}</span>
                </button>

                <button
                  onClick={() => setGitHubModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 5,
                    color: '#F1F1F5',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <GithubIcon size={13} />
                  <span>GitHub</span>
                </button>

                <button
                  onClick={() => handleEditProject(activeProject)}
                  className="btn btn-secondary btn-sm"
                  title={isRu ? 'Свойства проекта' : 'Project settings'}
                >
                  <Edit2 size={13} />
                </button>
              </div>
            </div>

            {/* Quality Project Tabs: All 11 Modules */}
            <div
              style={{
                display: 'flex',
                gap: 5,
                borderTop: '1px solid #25252D',
                paddingTop: 10,
                overflowX: 'auto',
              }}
            >
              {[
                { id: 'code', label: isRu ? 'Файлы & Код' : 'Files & Code', icon: <Code size={14} /> },
                { id: 'ai', label: isRu ? 'AI Агент' : 'AI Agent', icon: <Bot size={14} /> },
                { id: 'git', label: isRu ? 'Git & GitHub' : 'Git & GitHub', icon: <GitBranch size={14} /> },
                { id: 'terminal', label: isRu ? 'Терминал' : 'Terminal', icon: <Terminal size={14} /> },
                { id: 'board', label: isRu ? 'Kanban' : 'Kanban', icon: <Layers size={14} /> },
                { id: 'checklist', label: isRu ? 'Задачи' : 'Tasks', icon: <CheckSquare size={14} /> },
                { id: 'docs', label: isRu ? 'Документация' : 'Docs', icon: <BookOpen size={14} /> },
                { id: 'checkpoints', label: isRu ? 'Чекпоинты' : 'Checkpoints', icon: <ShieldCheck size={14} /> },
                { id: 'activity', label: isRu ? 'Активность' : 'Activity', icon: <Activity size={14} /> },
                { id: 'preview', label: isRu ? 'Предпросмотр' : 'Preview', icon: <Play size={14} /> },
                { id: 'settings', label: isRu ? 'Настройки' : 'Settings', icon: <Settings size={14} /> },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      border: isActive ? '1px solid rgba(139, 108, 255, 0.45)' : '1px solid transparent',
                      backgroundColor: isActive ? 'rgba(139, 108, 255, 0.12)' : 'transparent',
                      color: isActive ? '#F1F1F5' : '#92929F',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ color: isActive ? '#8B6CFF' : 'currentColor', display: 'flex' }}>
                      {tab.icon}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Tab Contents */}
          {/* TAB: Kanban Board */}
          {activeTab === 'board' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))',
                gap: 16,
                alignItems: 'start',
                overflowX: 'auto',
                paddingBottom: 20,
              }}
            >
              {KANBAN_COLUMNS.map(column => {
                const columnTasks = tasks.filter(
                  t => (t.kanban_column || (t.status === 'Done' ? 'Done' : 'To Do')) === column
                );

                return (
                  <div
                    key={column}
                    style={{
                      backgroundColor: '#0c0b14',
                      border: '1px solid rgba(139, 92, 246, 0.14)',
                      borderRadius: 10,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      minHeight: 380,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff' }}>
                          {translateColumn(column)}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 4,
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-dim)',
                          }}
                        >
                          {columnTasks.length}
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenAddTask(column)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#c084fc',
                          cursor: 'pointer',
                          padding: 4,
                        }}
                        title={isRu ? 'Добавить задачу' : 'Add task'}
                      >
                        <Plus size={15} />
                      </button>
                    </div>

                    {/* Task cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {columnTasks.map(t => (
                        <div
                          key={t.id}
                          style={{
                            backgroundColor: '#11101c',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 8,
                            padding: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            transition: 'border-color 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.35)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>
                              {t.title}
                            </span>
                            <button
                              onClick={() => handleDeleteTask(t.id)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
                              title={isRu ? 'Удалить' : 'Delete'}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {t.description && (
                            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.3 }}>
                              {t.description}
                            </p>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: 6 }}>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 3,
                                backgroundColor:
                                  t.priority === 'Critical'
                                    ? 'rgba(239, 68, 68, 0.18)'
                                    : t.priority === 'High'
                                    ? 'rgba(245, 158, 11, 0.18)'
                                    : 'rgba(255, 255, 255, 0.05)',
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

                            <div style={{ display: 'flex', gap: 4 }}>
                              {column !== 'To Do' && (
                                <button
                                  onClick={() => handleMoveTaskColumn(t, 'prev')}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
                                  title={isRu ? 'Назад' : 'Move back'}
                                >
                                  <ChevronLeft size={13} />
                                </button>
                              )}
                              {column !== 'Done' && (
                                <button
                                  onClick={() => handleMoveTaskColumn(t, 'next')}
                                  style={{ background: 'transparent', border: 'none', color: '#c084fc', cursor: 'pointer', padding: 2 }}
                                  title={isRu ? 'Вперед' : 'Move forward'}
                                >
                                  <ChevronRight size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: Project Checklist & Notes */}
          {activeTab === 'checklist' && (
            <ProjectChecklistTab
              project={activeProject}
              onProjectUpdated={up => {
                setActiveProject(up);
                setProjects(prev => prev.map(p => (p.id === up.id ? up : p)));
              }}
              isRu={isRu}
            />
          )}

          {/* TAB: Code Studio */}
          {activeTab === 'code' && (
            <CodeStudioTab
              project={activeProject}
              files={codeFiles}
              activeFileId={activeCodeFileId}
              onSelectFile={setActiveCodeFileId}
              onUpdateFileContent={(id, content) => {
                setCodeFiles(prev => prev.map(f => (f.id === id ? { ...f, content } : f)));
              }}
              onCreateFile={(name, language, content) => {
                const newF: CodeFile = {
                  id: 'f-' + Date.now(),
                  name,
                  path: name,
                  language,
                  content: content || '',
                };
                const updated = [...codeFiles, newF];
                setCodeFiles(updated);
                setActiveCodeFileId(newF.id);
                handleSaveCodeFiles(updated);
              }}
              onDeleteFile={id => {
                const rem = codeFiles.filter(f => f.id !== id);
                setCodeFiles(rem);
                if (activeCodeFileId === id) setActiveCodeFileId(rem[0]?.id || '');
                handleSaveCodeFiles(rem);
              }}
              onSaveAll={async () => {
                await handleSaveCodeFiles(codeFiles);
              }}
              onOpenPreview={() => setActiveTab('preview')}
              onOpenGit={() => setActiveTab('git')}
            />
          )}

          {/* TAB: Live Preview */}
          {activeTab === 'preview' && (
            <LivePreviewTab
              project={activeProject}
              files={codeFiles}
              onSwitchToCode={() => setActiveTab('code')}
            />
          )}

          {/* TAB: Git & Versions */}
          {activeTab === 'git' && (
            <GitControlTab
              project={activeProject}
              files={codeFiles}
              coworkingData={coworkingData}
              onUpdateCoworking={handleUpdateCoworkingData}
              onUpdateProject={async fields => {
                await api.updateProject(activeProject.id, fields);
                setActiveProject(prev => (prev ? { ...prev, ...fields } : null));
              }}
            />
          )}

          {/* TAB: AI Agent & Engineer */}
          {activeTab === 'ai' && (
            <AIAgentTab
              project={activeProject}
              files={codeFiles}
              onUpdateFiles={handleSaveCodeFiles}
              onUpdateProject={async fields => {
                await api.updateProject(activeProject.id, fields);
                setActiveProject(prev => (prev ? { ...prev, ...fields } : null));
              }}
              isRu={isRu}
            />
          )}

          {/* TAB: Embedded Interactive Terminal */}
          {activeTab === 'terminal' && (
            <ProjectTerminalTab
              project={activeProject}
              isRu={isRu}
            />
          )}

          {/* TAB: Technical Markdown Documentation */}
          {activeTab === 'docs' && (
            <ProjectDocsTab
              project={activeProject}
              files={codeFiles}
              onUpdateFiles={handleSaveCodeFiles}
              isRu={isRu}
            />
          )}

          {/* TAB: Snapshots & Safety Checkpoints */}
          {activeTab === 'checkpoints' && (
            <ProjectCheckpointsTab
              project={activeProject}
              files={codeFiles}
              onUpdateFiles={handleSaveCodeFiles}
              isRu={isRu}
            />
          )}

          {/* TAB: Project Activity History Log */}
          {activeTab === 'activity' && (
            <ProjectActivityTab
              project={activeProject}
              isRu={isRu}
            />
          )}

          {/* TAB: Settings & Danger Zone */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: 650, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                style={{
                  backgroundColor: '#0c0b14',
                  border: '1px solid rgba(139, 92, 246, 0.18)',
                  borderRadius: 11,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                  {isRu ? 'Параметры проекта' : 'Project Settings'}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="form-label">{isRu ? 'Название проекта' : 'Title'}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={activeProject.title}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="form-label">{isRu ? 'Описание' : 'Description'}</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={activeProject.description || ''}
                      readOnly
                    />
                  </div>

                  {activeProject.git_remote && (
                    <div>
                      <label className="form-label">{isRu ? 'Git Remote URL' : 'Git Remote'}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={activeProject.git_remote}
                        readOnly
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button
                      onClick={() => handleEditProject(activeProject)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Edit2 size={13} />
                      <span>{isRu ? 'Редактировать свойства' : 'Edit details'}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProject(activeProject)}
                      className="btn btn-danger btn-sm"
                    >
                      <Trash2 size={13} />
                      <span>{isRu ? 'Удалить проект' : 'Delete Project'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Project Edit/Create */}
      {isProjectModalOpen && (
        <div className="modal-overlay" onClick={() => setProjectModalOpen(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 480, backgroundColor: '#0c0b16', border: '1px solid rgba(139, 92, 246, 0.35)', borderRadius: 12, padding: 24 }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>
              {editingProject
                ? (isRu ? 'Редактировать проект' : 'Edit Project')
                : (isRu ? 'Создать новый проект' : 'Create Project')}
            </h3>

            <form onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">{isRu ? 'Название проекта' : 'Title'}</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={projectForm.title}
                  onChange={e => setProjectForm({ ...projectForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">{isRu ? 'Описание' : 'Description'}</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={projectForm.description}
                  onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">{isRu ? 'Статус' : 'Status'}</label>
                  <select
                    className="form-input"
                    value={projectForm.status}
                    onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                  >
                    <option value="Planning">{isRu ? 'Планирование' : 'Planning'}</option>
                    <option value="In Progress">{isRu ? 'В разработке' : 'In Progress'}</option>
                    <option value="Review">{isRu ? 'Ревью' : 'Review'}</option>
                    <option value="Completed">{isRu ? 'Завершен' : 'Completed'}</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">{isRu ? 'Цвет обложки' : 'Cover Color'}</label>
                  <input
                    type="color"
                    className="form-input"
                    style={{ height: 38, padding: 4 }}
                    value={projectForm.cover_color}
                    onChange={e => setProjectForm({ ...projectForm, cover_color: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setProjectModalOpen(false)}
                >
                  {isRu ? 'Отмена' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {isRu ? 'Сохранить' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Task Add */}
      {isTaskModalOpen && (
        <div className="modal-overlay" onClick={() => setTaskModalOpen(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 460, backgroundColor: '#0c0b16', border: '1px solid rgba(139, 92, 246, 0.35)', borderRadius: 12, padding: 24 }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: 14 }}>
              {isRu ? `Новая задача: ${translateColumn(taskColumn)}` : `New Task: ${taskColumn}`}
            </h3>

            <form onSubmit={handleSaveTask} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">{isRu ? 'Название задачи' : 'Title'}</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder={isRu ? 'Что нужно сделать?' : 'What needs to be done?'}
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">{isRu ? 'Описание / Детали' : 'Description'}</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">{isRu ? 'Приоритет' : 'Priority'}</label>
                <select
                  className="form-input"
                  value={taskForm.priority}
                  onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                >
                  <option value="Low">{isRu ? 'Низкий' : 'Low'}</option>
                  <option value="Normal">{isRu ? 'Обычный' : 'Normal'}</option>
                  <option value="High">{isRu ? 'Высокий' : 'High'}</option>
                  <option value="Critical">{isRu ? 'Критический' : 'Critical'}</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTaskModalOpen(false)}
                >
                  {isRu ? 'Отмена' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {isRu ? 'Добавить задачу' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GitHub Modal */}
      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setGitHubModalOpen(false)}
        onProjectImported={p => {
          setProjects(prev => [p, ...prev]);
          selectProject(p);
        }}
      />

      {/* Project Templates Modal */}
      <ProjectTemplatesModal
        isOpen={isTemplateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        isRu={isRu}
      />
    </div>
  );
};
