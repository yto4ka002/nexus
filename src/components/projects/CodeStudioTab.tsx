import React, { useState, useRef, useEffect } from 'react';
import {
  FileCode,
  FilePlus,
  Trash2,
  Save,
  Play,
  GitBranch,
  Code,
  FileText,
  Terminal as TerminalIcon,
  Sparkles,
  Check,
  Folder,
  FolderOpen,
  ExternalLink,
  Maximize2,
  Minimize2,
  X,
  Minus,
  Sidebar,
  RotateCw,
  ChevronRight,
  Search,
} from 'lucide-react';
import type { Project, CodeFile } from '../../types';
import { useApp } from '../../context/AppContext';
import * as api from '../../api';

interface CodeStudioTabProps {
  project: Project;
  files: CodeFile[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onUpdateFileContent: (id: string, content: string) => void;
  onCreateFile: (name: string, language: string, content?: string) => void;
  onDeleteFile: (id: string) => void;
  onSaveAll: () => Promise<void>;
  onOpenPreview: () => void;
  onOpenGit: () => void;
  onReloadDiskFiles?: () => Promise<void>;
  onOpenFolder?: () => Promise<void>;
}

const TEMPLATES = [
  {
    name: 'HTML5 HUD Canvas',
    lang: 'html',
    ext: '.html',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sci-Fi Interface</title>
  <style>
    body { background: #0a0915; color: #a78bfa; font-family: monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .box { border: 1px solid #8b5cf6; padding: 24px; border-radius: 8px; box-shadow: 0 0 20px rgba(139,92,246,0.3); text-align: center; }
    h1 { margin-bottom: 8px; color: #fff; }
  </style>
</head>
<body>
  <div class="box">
    <h1>NEXUS CORE ACTIVE</h1>
    <p>Telemetry Stream: Online</p>
  </div>
</body>
</html>`,
  },
  {
    name: 'Cyberpunk CSS Theme',
    lang: 'css',
    ext: '.css',
    code: `:root {
  --bg-deep: #07060c;
  --neon-violet: #8b5cf6;
  --neon-cyan: #06b6d4;
  --text-main: #f1f5f9;
}
body {
  background: var(--bg-deep);
  color: var(--text-main);
  font-family: 'JetBrains Mono', monospace;
}`,
  },
  {
    name: 'Telemetry Simulator (JS)',
    lang: 'javascript',
    ext: '.js',
    code: `function streamTelemetry() {
  const data = {
    velocity: (7800 + Math.random() * 20).toFixed(2),
    timestamp: new Date().toISOString()
  };
  console.log('[Telemetry Stream]', data);
}
setInterval(streamTelemetry, 3000);`,
  },
  {
    name: 'Markdown Documentation',
    lang: 'markdown',
    ext: '.md',
    code: `# Project Architecture Specs

## Overview
High performance local desktop module with reactive live preview.

## Components
- Canvas Radar Sweeper
- Telemetry Metrics Hub
- SQLite Persistent Cache`,
  },
];

interface TerminalLogItem {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timestamp: string;
}

export const CodeStudioTab: React.FC<CodeStudioTabProps> = ({
  project,
  files,
  activeFileId,
  onSelectFile,
  onUpdateFileContent,
  onCreateFile,
  onDeleteFile,
  onSaveAll,
  onOpenPreview,
  onOpenGit,
  onReloadDiskFiles,
  onOpenFolder,
}) => {
  const { language, addToast } = useApp();
  const isRu = language === 'ru';

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [isNewFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLang, setNewFileLang] = useState('javascript');
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [hydratedTabProjectId, setHydratedTabProjectId] = useState<number | null>(null);
  const [isQuickOpenOpen, setQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState('');
  const [quickOpenIndex, setQuickOpenIndex] = useState(0);
  const [dirtyFileIds, setDirtyFileIds] = useState<string[]>([]);

  // Terminal state inside Code Studio
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<TerminalLogItem[]>([]);
  const [terminalHistoryIdx, setTerminalHistoryIdx] = useState<number>(-1);
  const [isTerminalRunning, setIsTerminalRunning] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const quickOpenInputRef = useRef<HTMLInputElement>(null);
  const fileIdsKey = files.map(file => file.id).join('\u0000');
  const activeFile = files.find(f => f.id === activeFileId);
  const openTabs = openTabIds
    .map(id => files.find(file => file.id === id))
    .filter((file): file is CodeFile => Boolean(file));
  const projectDir = project.repo_path || 'C:\\Workspace\\' + project.title;
  const quickOpenFiles = files
    .filter(file => `${file.name} ${file.path}`.toLocaleLowerCase().includes(quickOpenQuery.trim().toLocaleLowerCase()))
    .slice(0, 40);

  const handleSelectFile = (id: string) => {
    setOpenTabIds(prev => prev.includes(id) ? prev : [...prev, id]);
    onSelectFile(id);
  };

  const markFileDirty = (id: string) => {
    setDirtyFileIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const handleCloseTab = async (id: string) => {
    if (dirtyFileIds.includes(id)) {
      try {
        await triggerSave(false);
      } catch (err) {
        console.warn('Could not save before closing tab', err);
        return;
      }
    }
    const closingIndex = openTabIds.indexOf(id);
    const nextTabs = openTabIds.filter(tabId => tabId !== id);
    setOpenTabIds(nextTabs);
    if (activeFileId === id) {
      const nextActiveId = nextTabs[Math.min(closingIndex, nextTabs.length - 1)] || '';
      onSelectFile(nextActiveId);
    }
  };

  useEffect(() => {
    if (files.length === 0) return;

    if (hydratedTabProjectId !== project.id) {
      const tabsKey = `nexus_open_tabs_${project.id}`;
      const activeKey = `nexus_active_file_${project.id}`;
      let savedIds: string[] = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(tabsKey) || '[]');
        if (Array.isArray(parsed)) savedIds = parsed.filter((id): id is string => typeof id === 'string');
      } catch {
        savedIds = [];
      }

      const availableIds = new Set(files.map(file => file.id));
      const nextTabs = savedIds.filter(id => availableIds.has(id));
      let savedActiveId = '';
      try {
        savedActiveId = localStorage.getItem(activeKey) || '';
      } catch {
        savedActiveId = '';
      }

      if (savedActiveId && availableIds.has(savedActiveId) && !nextTabs.includes(savedActiveId)) {
        nextTabs.push(savedActiveId);
      }
      if (nextTabs.length === 0 && activeFileId && availableIds.has(activeFileId)) nextTabs.push(activeFileId);
      if (nextTabs.length === 0) nextTabs.push(files[0].id);

      setOpenTabIds(nextTabs);
      setDirtyFileIds([]);
      setHydratedTabProjectId(project.id);
      const nextActiveId = savedActiveId && nextTabs.includes(savedActiveId)
        ? savedActiveId
        : nextTabs.includes(activeFileId) ? activeFileId : nextTabs[0];
      if (activeFileId !== nextActiveId) onSelectFile(nextActiveId);
      return;
    }

    const availableIds = new Set(files.map(file => file.id));
    const nextTabs = openTabIds.filter(id => availableIds.has(id));
    if (activeFileId && availableIds.has(activeFileId) && !nextTabs.includes(activeFileId)) {
      nextTabs.push(activeFileId);
    }
    if (nextTabs.length !== openTabIds.length || nextTabs.some((id, index) => id !== openTabIds[index])) {
      setOpenTabIds(nextTabs);
    }
  }, [project.id, fileIdsKey, hydratedTabProjectId, openTabIds, activeFileId, files, onSelectFile]);

  useEffect(() => {
    if (hydratedTabProjectId !== project.id) return;
    try {
      localStorage.setItem(`nexus_open_tabs_${project.id}`, JSON.stringify(openTabIds));
      if (activeFileId) localStorage.setItem(`nexus_active_file_${project.id}`, activeFileId);
      else localStorage.removeItem(`nexus_active_file_${project.id}`);
    } catch (err) {
      console.warn('Could not save editor tabs', err);
    }
  }, [project.id, hydratedTabProjectId, openTabIds, activeFileId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setIsTerminalOpen(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && activeFileId) {
        e.preventDefault();
        if (!isQuickOpenOpen) handleCloseTab(activeFileId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setQuickOpenOpen(true);
        setQuickOpenQuery('');
        setQuickOpenIndex(0);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, activeFileId, openTabIds, isQuickOpenOpen]);

  useEffect(() => {
    if (isQuickOpenOpen) quickOpenInputRef.current?.focus();
  }, [isQuickOpenOpen]);

  useEffect(() => {
    if (isTerminalOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalHistory, isTerminalOpen]);

  // Calculate lines for gutter
  const lineCount = activeFile ? activeFile.content.split('\n').length : 1;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const updateCursorPosition = (textarea: HTMLTextAreaElement) => {
    const selStart = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, selStart);
    const lines = textBefore.split('\n');
    const currentLine = lines.length;
    const currentCol = lines[lines.length - 1].length + 1;
    setCursorPos({ line: currentLine, col: currentCol });
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.html')) return <Code size={14} color="#f97316" />;
    if (fileName.endsWith('.css')) return <FileText size={14} color="#38bdf8" />;
    if (fileName.endsWith('.js') || fileName.endsWith('.ts') || fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
      return <TerminalIcon size={14} color="#fbbf24" />;
    }
    if (fileName.endsWith('.json')) return <FileCode size={14} color="#a855f7" />;
    if (fileName.endsWith('.md')) return <FileCode size={14} color="#34d399" />;
    if (fileName.endsWith('.rs')) return <FileCode size={14} color="#f97316" />;
    if (fileName.endsWith('.py')) return <FileCode size={14} color="#60a5fa" />;
    return <FileCode size={14} color="#94a3b8" />;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Intercept Tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentVal = textarea.value;

      const updatedVal = currentVal.substring(0, start) + '  ' + currentVal.substring(end);
      if (activeFile) {
        onUpdateFileContent(activeFile.id, updatedVal);
        markFileDirty(activeFile.id);
      }

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateCursorPosition(textarea);
      }, 0);
    }

    // Intercept Ctrl + S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      triggerSave();
    }
  };

  const triggerSave = async (notify = true) => {
    if (project.repo_path && activeFile) {
      const diskPath = activeFile.full_path || (project.repo_path.replace(/[\\/]+$/, '') + '\\' + activeFile.path.replace(/\//g, '\\'));
      try {
        await api.saveFileToDisk(diskPath, activeFile.content);
      } catch (err) {
        console.warn('Failed saving file to disk:', err);
      }
    }
    await onSaveAll();
    setDirtyFileIds([]);
    setIsSavedRecently(true);
    if (notify) {
      addToast(
        isRu ? 'Файлы сохранены' : 'Files Saved',
        project.repo_path
          ? (isRu ? 'Записано на диск и в проект' : 'Saved to disk and project')
          : (isRu ? 'Все изменения записаны' : 'All changes saved'),
        'success'
      );
    }
    setTimeout(() => setIsSavedRecently(false), 2000);
  };

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    let name = newFileName.trim();
    let lang = newFileLang;
    if (name.endsWith('.html')) lang = 'html';
    else if (name.endsWith('.css')) lang = 'css';
    else if (name.endsWith('.js')) lang = 'javascript';
    else if (name.endsWith('.ts')) lang = 'typescript';
    else if (name.endsWith('.tsx')) lang = 'typescript';
    else if (name.endsWith('.jsx')) lang = 'javascript';
    else if (name.endsWith('.md')) lang = 'markdown';
    else if (name.endsWith('.json')) lang = 'json';
    else if (name.endsWith('.py')) lang = 'python';
    else if (name.endsWith('.rs')) lang = 'rust';
    else {
      if (lang === 'html') name += '.html';
      else if (lang === 'css') name += '.css';
      else if (lang === 'javascript') name += '.js';
      else if (lang === 'markdown') name += '.md';
    }

    onCreateFile(name, lang);
    setNewFileName('');
    setNewFileModalOpen(false);
    addToast(isRu ? 'Файл создан' : 'File Created', name, 'success');
  };

  const handleInsertTemplate = (tmpl: typeof TEMPLATES[0]) => {
    const fileName = `template_${Date.now().toString().slice(-4)}${tmpl.ext}`;
    onCreateFile(fileName, tmpl.lang, tmpl.code);
    setShowTemplatesDropdown(false);
    addToast(isRu ? 'Шаблон добавлен' : 'Template Added', tmpl.name, 'success');
  };

  // Terminal commands inside VS Code panel
  const handleRunTerminalCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || terminalInput).trim();
    if (!cmd || isTerminalRunning) return;

    setIsTerminalRunning(true);
    setTerminalInput('');
    setTerminalHistoryIdx(-1);

    const now = new Date().toLocaleTimeString();

    try {
      const res = await api.runProjectTerminal(project.repo_path, cmd);
      const item: TerminalLogItem = {
        id: `term-${Date.now()}`,
        command: cmd,
        stdout: res.stdout,
        stderr: res.stderr,
        exitCode: res.exit_code,
        durationMs: res.duration_ms,
        timestamp: now,
      };

      setTerminalHistory(prev => [...prev, item]);
      api.logActivity(project.id, 'terminal', `Команда терминала: ${cmd}`, `exit: ${res.exit_code}`);
    } catch (err: any) {
      setTerminalHistory(prev => [
        ...prev,
        {
          id: `term-${Date.now()}`,
          command: cmd,
          stdout: '',
          stderr: String(err),
          exitCode: 1,
          durationMs: 0,
          timestamp: now,
        },
      ]);
    } finally {
      setIsTerminalRunning(false);
    }
  };

  const handleTerminalInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRunTerminalCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalHistory.length > 0) {
        const nextIdx = terminalHistoryIdx === -1 ? terminalHistory.length - 1 : Math.max(0, terminalHistoryIdx - 1);
        setTerminalHistoryIdx(nextIdx);
        setTerminalInput(terminalHistory[nextIdx].command);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (terminalHistoryIdx !== -1) {
        const nextIdx = terminalHistoryIdx + 1;
        if (nextIdx < terminalHistory.length) {
          setTerminalHistoryIdx(nextIdx);
          setTerminalInput(terminalHistory[nextIdx].command);
        } else {
          setTerminalHistoryIdx(-1);
          setTerminalInput('');
        }
      }
    }
  };

  const handleQuickOpenKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setQuickOpenIndex(index => Math.min(index + 1, Math.max(quickOpenFiles.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setQuickOpenIndex(index => Math.max(index - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const file = quickOpenFiles[quickOpenIndex];
      if (file) {
        handleSelectFile(file.id);
        setQuickOpenOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuickOpenOpen(false);
    }
  };

  const presets = ['git status', 'git log -n 3 --oneline', 'npm run dev', 'dir'];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0B0B0E',
        color: '#F1F1F5',
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        ...(isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999999,
              width: '100vw',
              height: '100vh',
              borderRadius: 0,
              border: 'none',
              boxShadow: 'none',
            }
          : {
              height: 'calc(100vh - 215px)',
              minHeight: 560,
              borderRadius: 8,
              border: '1px solid #25252D',
            }),
      }}
    >
      {/* 1. TOP VS CODE WORKSPACE HEADER */}
      <div
        style={{
          height: 36,
          backgroundColor: '#111115',
          borderBottom: '1px solid #25252D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: 'transparent',
              border: 'none',
              color: isSidebarOpen ? '#8B6CFF' : '#92929F',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              borderRadius: 4,
            }}
            title={isRu ? 'Переключить боковую панель (Ctrl+B)' : 'Toggle Primary Sidebar (Ctrl+B)'}
          >
            <Sidebar size={15} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
            <Folder size={14} color="#8B6CFF" />
            <span style={{ color: '#F1F1F5' }}>{project.title}</span>
            <span style={{ color: '#4b4b58' }}>&bull;</span>
            <span style={{ color: '#92929F', fontSize: '0.74rem' }}>{projectDir}</span>
          </div>
        </div>

        {/* Right Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => {
              setQuickOpenQuery('');
              setQuickOpenIndex(0);
              setQuickOpenOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              borderRadius: 4,
              color: '#A78BFA',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
            title={isRu ? 'Быстро открыть файл (Ctrl+P)' : 'Quick Open File (Ctrl+P)'}
          >
            <Search size={12} />
            <span>{isRu ? 'Найти файл' : 'Find File'}</span>
            <span style={{ color: '#686877', fontSize: '0.66rem' }}>Ctrl+P</span>
          </button>

          {/* Templates */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 9px',
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 4,
                color: '#92929F',
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
              title={isRu ? 'Вставить готовый шаблон' : 'Insert Code Template'}
            >
              <Sparkles size={13} color="#f59e0b" />
              <span>{isRu ? 'Шаблоны' : 'Templates'}</span>
            </button>

            {showTemplatesDropdown && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  zIndex: 200,
                  backgroundColor: '#16161C',
                  border: '1px solid #25252D',
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  width: 230,
                  overflow: 'hidden',
                }}
              >
                {TEMPLATES.map(tmpl => (
                  <div
                    key={tmpl.name}
                    onClick={() => handleInsertTemplate(tmpl)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #25252D',
                      fontSize: '0.78rem',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(139, 108, 255, 0.15)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#F1F1F5' }}>{tmpl.name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#8B6CFF' }}>{tmpl.ext}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open Folder */}
          {onOpenFolder && (
            <button
              type="button"
              onClick={onOpenFolder}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 9px',
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 4,
                color: '#A78BFA',
                fontSize: '0.74rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title={isRu ? 'Открыть готовую папку с кодом (локальный каталог)' : 'Open local project folder'}
            >
              <FolderOpen size={12} color="#8B6CFF" />
              <span>{isRu ? 'Папка' : 'Folder'}</span>
            </button>
          )}

          {/* Live Preview */}
          <button
            type="button"
            onClick={onOpenPreview}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              backgroundColor: 'rgba(139, 108, 255, 0.12)',
              border: '1px solid rgba(139, 108, 255, 0.4)',
              borderRadius: 4,
              color: '#A78BFA',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title={isRu ? 'Запустить превью' : 'Live Preview'}
          >
            <Play size={12} fill="#8B6CFF" />
            <span>{isRu ? 'Превью' : 'Preview'}</span>
          </button>

          {/* Save All */}
          <button
            type="button"
            onClick={() => triggerSave()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              borderRadius: 4,
              color: isSavedRecently ? '#10b981' : dirtyFileIds.length ? '#f59e0b' : '#92929F',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
            title={isRu ? 'Сохранить (Ctrl+S)' : 'Save (Ctrl+S)'}
          >
            {isSavedRecently ? <Check size={12} color="#10b981" /> : <Save size={12} color={dirtyFileIds.length ? '#f59e0b' : undefined} />}
            <span>{isSavedRecently ? (isRu ? 'Сохранено' : 'Saved') : dirtyFileIds.length ? (isRu ? `Сохранить · ${dirtyFileIds.length}` : `Save · ${dirtyFileIds.length}`) : (isRu ? 'Сохранить' : 'Save')}</span>
          </button>

          {/* Toggle Integrated Terminal */}
          <button
            type="button"
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              backgroundColor: isTerminalOpen ? 'rgba(139, 108, 255, 0.2)' : '#16161C',
              border: `1px solid ${isTerminalOpen ? '#8B6CFF' : '#25252D'}`,
              borderRadius: 4,
              color: isTerminalOpen ? '#F1F1F5' : '#92929F',
              fontSize: '0.74rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title={isRu ? 'Терминал (Ctrl+`)' : 'Toggle Terminal Panel (Ctrl+`)'}
          >
            <TerminalIcon size={12} color={isTerminalOpen ? '#8B6CFF' : 'currentColor'} />
            <span>{isRu ? 'Терминал' : 'Terminal'}</span>
          </button>

          {/* Git */}
          <button
            type="button"
            onClick={onOpenGit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              borderRadius: 4,
              color: '#92929F',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
            title="Git"
          >
            <GitBranch size={12} />
            <span>Git</span>
          </button>

          {/* Fullscreen Toggle (VS Code Style) */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              backgroundColor: isFullscreen ? 'rgba(139, 108, 255, 0.25)' : '#16161C',
              border: `1px solid ${isFullscreen ? '#8B6CFF' : '#25252D'}`,
              borderRadius: 4,
              color: isFullscreen ? '#F1F1F5' : '#92929F',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title={
              isFullscreen
                ? isRu
                  ? 'Выйти из полноэкранного режима (Esc / F11)'
                  : 'Exit Fullscreen (Esc / F11)'
                : isRu
                ? 'На весь экран в стиле Visual Studio (F11)'
                : 'Fullscreen IDE (F11)'
            }
          >
            {isFullscreen ? <Minimize2 size={13} color="#8B6CFF" /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? (isRu ? 'Свернуть' : 'Exit') : (isRu ? 'Фулл экран' : 'Fullscreen')}</span>
          </button>

          {/* Fullscreen Native Window Controls */}
          {isFullscreen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 6, borderLeft: '1px solid #25252D', paddingLeft: 6 }}>
              <button
                type="button"
                onClick={() => api.windowMinimize()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#92929F',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 4,
                  display: 'flex',
                }}
                title={isRu ? 'Свернуть окно' : 'Minimize window'}
              >
                <Minus size={13} />
              </button>
              <button
                type="button"
                onClick={() => api.windowClose()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#92929F',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 4,
                  display: 'flex',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#92929F')}
                title={isRu ? 'Закрыть' : 'Close'}
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. MAIN VS CODE WORKSPACE: SIDEBAR + EDITOR GROUP */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left Explorer Sidebar (Compact) */}
        {isSidebarOpen && (
          <div
            style={{
              width: isFullscreen ? 160 : 180,
              backgroundColor: '#111115',
              borderRight: '1px solid #25252D',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              userSelect: 'none',
              transition: 'width 0.15s ease',
            }}
          >
            {/* Sidebar Title */}
            <div
              style={{
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                borderBottom: '1px solid #25252D',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#92929F',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              <span>{isRu ? 'Файлы' : 'Explorer'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {project.repo_path && onReloadDiskFiles && (
                  <button
                    type="button"
                    onClick={onReloadDiskFiles}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#92929F',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                    }}
                    title={isRu ? 'Обновить файлы с диска' : 'Reload from disk'}
                  >
                    <RotateCw size={11} />
                  </button>
                )}
                {onOpenFolder && (
                  <button
                    type="button"
                    onClick={onOpenFolder}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#92929F',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                    }}
                    title={isRu ? 'Открыть готовую папку...' : 'Open folder...'}
                  >
                    <FolderOpen size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNewFileModalOpen(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#92929F',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                  }}
                  title={isRu ? 'Новый файл' : 'New File'}
                >
                  <FilePlus size={12} />
                </button>
              </div>
            </div>

            {/* Folder section header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#A78BFA',
                backgroundColor: '#16161C',
                borderBottom: '1px solid #25252D',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                <ChevronRight size={11} />
                <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {project.title.toUpperCase()}
                </span>
              </div>
              {project.repo_path && (
                <button
                  type="button"
                  onClick={() => api.openFolderInExplorer(project.repo_path!)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#686877',
                    cursor: 'pointer',
                    padding: 1,
                    display: 'flex',
                  }}
                  title={isRu ? 'Показать в Проводнике Windows' : 'Reveal in Explorer'}
                >
                  <ExternalLink size={10} />
                </button>
              )}
            </div>

            {/* If no folder linked, button to connect */}
            {!project.repo_path && onOpenFolder && (
              <div style={{ padding: '6px 8px', borderBottom: '1px solid #25252D' }}>
                <button
                  type="button"
                  onClick={onOpenFolder}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    backgroundColor: 'rgba(139, 108, 255, 0.1)',
                    border: '1px solid rgba(139, 108, 255, 0.35)',
                    borderRadius: 4,
                    color: '#A78BFA',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                  }}
                >
                  <FolderOpen size={11} />
                  <span>{isRu ? 'Открыть папку' : 'Open Folder'}</span>
                </button>
              </div>
            )}

            {/* File List Tree */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '3px 0' }}>
              {files.map(file => {
                const isActive = file.id === (activeFile?.id || '');
                return (
                  <div
                    key={file.id}
                    onClick={() => handleSelectFile(file.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      color: isActive ? '#F1F1F5' : '#92929F',
                      backgroundColor: isActive ? '#16161C' : 'transparent',
                      borderLeft: isActive ? '2px solid #8B6CFF' : '2px solid transparent',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      {getFileIcon(file.name)}
                      <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {file.name}
                      </span>
                    </div>

                    {files.length > 1 && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onDeleteFile(file.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#686877',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#686877')}
                        title={isRu ? 'Удалить файл' : 'Delete file'}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right Editor Group (Tabs + Code + Docked Terminal) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* File Tabs Bar */}
          <div
            style={{
              height: 35,
              backgroundColor: '#111115',
              borderBottom: '1px solid #25252D',
              display: 'flex',
              overflowX: 'auto',
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            {openTabs.map(file => {
              const isActive = file.id === (activeFile?.id || '');
              return (
                <div
                  key={file.id}
                  onClick={() => handleSelectFile(file.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '0 12px',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    color: isActive ? '#F1F1F5' : '#92929F',
                    backgroundColor: isActive ? '#0B0B0E' : '#111115',
                    borderTop: isActive ? '2px solid #8B6CFF' : '2px solid transparent',
                    borderRight: '1px solid #25252D',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {getFileIcon(file.name)}
                  <span>{file.name}</span>
                  {dirtyFileIds.includes(file.id) && (
                    <span title={isRu ? 'Есть несохранённые изменения' : 'Unsaved changes'} style={{ color: '#f59e0b', fontSize: '0.8rem', lineHeight: 1 }}>●</span>
                  )}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleCloseTab(file.id);
                    }}
                    aria-label={isRu ? `Закрыть вкладку ${file.name}` : `Close ${file.name} tab`}
                    title={isRu ? 'Закрыть вкладку · файл останется в проекте' : 'Close tab · file stays in project'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#686877',
                      cursor: 'pointer',
                      padding: 2,
                      marginLeft: 4,
                      display: 'flex',
                      borderRadius: 3,
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#686877')}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            {openTabs.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', color: '#686877', fontSize: '0.72rem' }}>
                {isRu ? 'Нет открытых вкладок · выберите файл слева' : 'No open tabs · choose a file from the sidebar'}
              </div>
            )}
          </div>

          {/* Breadcrumb Path Bar */}
          <div
            style={{
              height: 22,
              backgroundColor: '#111115',
              borderBottom: '1px solid #25252D',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              fontSize: '0.7rem',
              color: '#686877',
              gap: 6,
              flexShrink: 0,
            }}
          >
            <span>{project.title}</span>
            <span>&rsaquo;</span>
            <span style={{ color: '#F1F1F5', fontWeight: 500 }}>{activeFile?.name || ''}</span>
          </div>

          {/* Central Editor Area (Line Numbers Gutter + Textarea) */}
          <div
            style={{
              flex: isTerminalMaximized ? 0 : 1,
              display: isTerminalMaximized ? 'none' : 'flex',
              minHeight: 0,
              backgroundColor: '#0B0B0E',
              overflow: 'hidden',
            }}
          >
            {/* Line numbers gutter */}
            <div
              style={{
                width: 46,
                backgroundColor: '#111115',
                borderRight: '1px solid #25252D',
                color: '#686877',
                fontFamily: 'var(--font-mono, "JetBrains Mono", Consolas, monospace)',
                fontSize: '0.82rem',
                lineHeight: '1.55rem',
                textAlign: 'right',
                padding: '10px 8px 10px 0',
                userSelect: 'none',
                overflowY: 'hidden',
                flexShrink: 0,
              }}
            >
              {lineNumbers.map(n => (
                <div
                  key={n}
                  style={{
                    color: n === cursorPos.line ? '#8B6CFF' : '#686877',
                    fontWeight: n === cursorPos.line ? 700 : 400,
                  }}
                >
                  {n}
                </div>
              ))}
            </div>

            {/* Code text editor */}
            <textarea
              ref={textareaRef}
              value={activeFile ? activeFile.content : ''}
              onChange={e => {
                if (activeFile) {
                  onUpdateFileContent(activeFile.id, e.target.value);
                  markFileDirty(activeFile.id);
                }
                updateCursorPosition(e.target);
              }}
              onSelect={e => updateCursorPosition(e.currentTarget)}
              onClick={e => updateCursorPosition(e.currentTarget)}
              onKeyUp={e => updateCursorPosition(e.currentTarget)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              wrap="off"
              style={{
                flex: 1,
                backgroundColor: '#0B0B0E',
                color: '#e2e8f0',
                fontFamily: 'var(--font-mono, "JetBrains Mono", "Fira Code", Consolas, monospace)',
                fontSize: '0.84rem',
                lineHeight: '1.55rem',
                padding: '10px 14px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                tabSize: 2,
                overflow: 'auto',
                caretColor: '#8B6CFF',
              }}
              placeholder={isRu ? '// Введите код здесь...' : '// Enter code here...'}
            />
          </div>

          {/* 3. DOCKED INTEGRATED TERMINAL PANEL (VS CODE STYLE) */}
          {isTerminalOpen && (
            <div
              style={{
                height: isTerminalMaximized ? '100%' : 240,
                backgroundColor: '#0B0B0E',
                borderTop: '1px solid #25252D',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {/* Panel Header */}
              <div
                style={{
                  height: 32,
                  backgroundColor: '#111115',
                  borderBottom: '1px solid #25252D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  userSelect: 'none',
                  flexShrink: 0,
                }}
              >
                {/* Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#F1F1F5',
                      borderBottom: '2px solid #8B6CFF',
                      padding: '6px 0',
                      letterSpacing: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>TERMINAL</span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        padding: '1px 5px',
                        borderRadius: 3,
                        backgroundColor: '#16161C',
                        color: '#8B6CFF',
                        border: '1px solid #25252D',
                      }}
                    >
                      1: pwsh
                    </span>
                  </div>

                  <span style={{ fontSize: '0.72rem', color: '#686877', cursor: 'pointer' }}>OUTPUT</span>
                  <span style={{ fontSize: '0.72rem', color: '#686877', cursor: 'pointer' }}>PROBLEMS (0)</span>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Preset quick buttons */}
                  <div style={{ display: 'flex', gap: 4, marginRight: 6 }}>
                    {presets.map(p => (
                      <button
                        key={p}
                        onClick={() => handleRunTerminalCommand(p)}
                        disabled={isTerminalRunning}
                        style={{
                          background: '#16161C',
                          border: '1px solid #25252D',
                          borderRadius: 3,
                          color: '#92929F',
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '1px 6px',
                          cursor: 'pointer',
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setTerminalHistory([])}
                    style={{ background: 'transparent', border: 'none', color: '#686877', cursor: 'pointer', padding: 3 }}
                    title={isRu ? 'Очистить консоль' : 'Clear Terminal'}
                  >
                    <Trash2 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTerminalMaximized(!isTerminalMaximized)}
                    style={{ background: 'transparent', border: 'none', color: '#686877', cursor: 'pointer', padding: 3 }}
                    title={isTerminalMaximized ? (isRu ? 'Восстановить размер' : 'Restore Panel') : (isRu ? 'Развернуть панель' : 'Maximize Panel')}
                  >
                    {isTerminalMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTerminalOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: '#686877', cursor: 'pointer', padding: 3 }}
                    title={isRu ? 'Закрыть панель (Ctrl+`)' : 'Close Panel (Ctrl+`)'}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Terminal Logs & Output */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '8px 14px',
                  fontFamily: 'var(--font-mono, "JetBrains Mono", Consolas, monospace)',
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                  backgroundColor: '#0B0B0E',
                }}
              >
                <div style={{ color: '#686877', marginBottom: 8 }}>
                  Windows PowerShell [NEXUS Terminal Session: {projectDir}]
                </div>

                {terminalHistory.map(item => (
                  <div key={item.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A78BFA' }}>
                      <span style={{ color: '#38bdf8' }}>PS {projectDir}&gt;</span>
                      <span style={{ color: '#F1F1F5', fontWeight: 600 }}>{item.command}</span>
                      <span style={{ fontSize: '0.68rem', color: '#686877', marginLeft: 'auto' }}>
                        {item.durationMs}ms &bull; exit: {item.exitCode}
                      </span>
                    </div>

                    {item.stdout && (
                      <pre
                        style={{
                          margin: '4px 0 0 0',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          color: '#e2e8f0',
                        }}
                      >
                        {item.stdout}
                      </pre>
                    )}

                    {item.stderr && (
                      <pre
                        style={{
                          margin: '4px 0 0 0',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          color: '#ef4444',
                        }}
                      >
                        {item.stderr}
                      </pre>
                    )}
                  </div>
                ))}

                <div ref={terminalEndRef} />
              </div>

              {/* Terminal Input Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  backgroundColor: '#111115',
                  borderTop: '1px solid #25252D',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                }}
              >
                <span style={{ color: '#38bdf8', marginRight: 6, whiteSpace: 'nowrap' }}>PS&gt;</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={e => setTerminalInput(e.target.value)}
                  onKeyDown={handleTerminalInputKeyDown}
                  disabled={isTerminalRunning}
                  placeholder={
                    isTerminalRunning
                      ? isRu
                        ? 'Выполняется...'
                        : 'Running...'
                      : isRu
                      ? 'Введите команду (Enter для запуска, Вверх/Вниз для истории)...'
                      : 'Type command (Enter to run, Up/Down for history)...'
                  }
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#F1F1F5',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                  }}
                />
                {isTerminalRunning && (
                  <RotateCw size={13} color="#8B6CFF" className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
                )}
              </div>
            </div>
          )}

          {/* 4. VS CODE BOTTOM STATUS BAR */}
          <div
            style={{
              height: 22,
              backgroundColor: '#111115',
              borderTop: '1px solid #25252D',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 10px',
              fontSize: '0.7rem',
              color: '#92929F',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            {/* Left Status Bar Items */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                onClick={onOpenGit}
                title="Git Branch"
              >
                <GitBranch size={12} color="#8B6CFF" />
                <span>{project.git_branch || 'main'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#686877' }}>
                <span>0 &#x2297;</span>
                <span>0 &#x26A0;</span>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: isTerminalOpen ? '#8B6CFF' : '#92929F' }}
                onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                title={isRu ? 'Переключить терминал (Ctrl+`)' : 'Toggle Terminal (Ctrl+`)'}
              >
                <TerminalIcon size={11} />
                <span>pwsh</span>
              </div>
            </div>

            {/* Right Status Bar Items */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>
                Ln {cursorPos.line}, Col {cursorPos.col}
              </span>
              <span>{lineCount} {isRu ? 'стр.' : 'lines'}</span>
              <span>Spaces: 2</span>
              <span>UTF-8</span>
              <span style={{ color: '#8B6CFF', fontWeight: 600, textTransform: 'uppercase' }}>
                {activeFile?.language || 'text'}
              </span>
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isFullscreen ? '#8B6CFF' : '#92929F',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
                title={isRu ? 'На весь экран (F11)' : 'Toggle Fullscreen (F11)'}
              >
                {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isQuickOpenOpen && (
        <div
          className="modal-overlay"
          onClick={() => setQuickOpenOpen(false)}
          style={{ zIndex: 1200, alignItems: 'flex-start', paddingTop: '12vh' }}
        >
          <div
            onClick={event => event.stopPropagation()}
            style={{
              width: 'min(620px, calc(100vw - 32px))',
              maxHeight: '70vh',
              overflow: 'hidden',
              background: '#141419',
              border: '1px solid rgba(167, 139, 250, 0.35)',
              borderRadius: 12,
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.65)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #25252D' }}>
              <Search size={17} color="#A78BFA" />
              <input
                ref={quickOpenInputRef}
                type="search"
                value={quickOpenQuery}
                onChange={event => {
                  setQuickOpenQuery(event.target.value);
                  setQuickOpenIndex(0);
                }}
                onKeyDown={handleQuickOpenKeyDown}
                placeholder={isRu ? 'Введите имя или путь файла…' : 'Type a file name or path…'}
                aria-label={isRu ? 'Быстрый поиск файла' : 'Quick file search'}
                style={{ flex: 1, minWidth: 0, padding: '7px 0', border: 0, outline: 0, color: '#F1F1F5', background: 'transparent', fontSize: '0.92rem' }}
              />
              <kbd style={{ padding: '3px 6px', color: '#92929F', border: '1px solid #33323d', borderRadius: 4, fontSize: '0.68rem' }}>ESC</kbd>
            </div>

            <div style={{ overflowY: 'auto', padding: 6 }}>
              {quickOpenFiles.length === 0 ? (
                <div style={{ padding: '22px 14px', color: '#92929F', textAlign: 'center', fontSize: '0.82rem' }}>
                  {isRu ? 'Файлы не найдены' : 'No files found'}
                </div>
              ) : quickOpenFiles.map((file, index) => (
                <button
                  key={file.id}
                  type="button"
                  onMouseEnter={() => setQuickOpenIndex(index)}
                  onClick={() => {
                    handleSelectFile(file.id);
                    setQuickOpenOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 10px',
                    border: 0,
                    borderRadius: 7,
                    color: index === quickOpenIndex ? '#F1F1F5' : '#C4C4CE',
                    textAlign: 'left',
                    background: index === quickOpenIndex ? 'rgba(139, 108, 255, 0.14)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {getFileIcon(file.name)}
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{file.path || file.name}</span>
                  {openTabIds.includes(file.id) && <span style={{ color: '#8B6CFF', fontSize: '0.66rem' }}>{isRu ? 'открыт' : 'open'}</span>}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, padding: '8px 12px', borderTop: '1px solid #25252D', color: '#777785', fontSize: '0.67rem' }}>
              <span>↑↓ {isRu ? 'выбрать' : 'navigate'}</span>
              <span>↵ {isRu ? 'открыть' : 'open'}</span>
              <span>Esc {isRu ? 'закрыть' : 'close'}</span>
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {isNewFileModalOpen && (
        <div className="modal-overlay" onClick={() => setNewFileModalOpen(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 400, backgroundColor: '#111115', border: '1px solid #25252D', borderRadius: 8, padding: 20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F1F1F5' }}>
                {isRu ? 'Создать новый файл' : 'Create New File'}
              </span>
              <button
                type="button"
                onClick={() => setNewFileModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#92929F', cursor: 'pointer', fontSize: 16 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateFileSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">{isRu ? 'Имя файла' : 'File Name'}</label>
                  <input
                    type="text"
                    className="form-input"
                    autoFocus
                    placeholder="component.tsx, style.css, index.html"
                    value={newFileName}
                    onChange={e => setNewFileName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{isRu ? 'Тип файла' : 'File Type'}</label>
                  <select
                    className="form-input"
                    value={newFileLang}
                    onChange={e => setNewFileLang(e.target.value)}
                  >
                    <option value="javascript">JavaScript (.js)</option>
                    <option value="typescript">TypeScript (.ts / .tsx)</option>
                    <option value="html">HTML (.html)</option>
                    <option value="css">CSS (.css)</option>
                    <option value="markdown">Markdown (.md)</option>
                    <option value="json">JSON (.json)</option>
                    <option value="python">Python (.py)</option>
                    <option value="rust">Rust (.rs)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setNewFileModalOpen(false)}
                >
                  {isRu ? 'Отмена' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {isRu ? 'Создать' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
