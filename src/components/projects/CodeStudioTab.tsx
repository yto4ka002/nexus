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
  Terminal,
  Sparkles,
  Check,
  Folder,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { Project, CodeFile } from '../../types';
import { useApp } from '../../context/AppContext';

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
}) => {
  const { language, addToast } = useApp();
  const isRu = language === 'ru';

  const [isNewFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLang, setNewFileLang] = useState('javascript');
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  // Calculate lines for gutter
  const lineCount = activeFile ? activeFile.content.split('\n').length : 1;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.html')) return <Code size={14} color="#f97316" />;
    if (fileName.endsWith('.css')) return <FileText size={14} color="#38bdf8" />;
    if (fileName.endsWith('.js') || fileName.endsWith('.ts')) return <Terminal size={14} color="#fbbf24" />;
    if (fileName.endsWith('.json')) return <FileCode size={14} color="#a855f7" />;
    if (fileName.endsWith('.md')) return <FileCode size={14} color="#34d399" />;
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
      }

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }

    // Intercept Ctrl + S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      triggerSave();
    }
  };

  const triggerSave = async () => {
    await onSaveAll();
    setIsSavedRecently(true);
    addToast(isRu ? 'Файлы сохранены' : 'Files Saved', isRu ? 'Все изменения записаны' : 'All changes saved', 'success');
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
    else if (name.endsWith('.md')) lang = 'markdown';
    else if (name.endsWith('.json')) lang = 'json';
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'all 0.18s ease',
        ...(isFullscreen
          ? {
              position: 'fixed',
              top: 38,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 900,
              backgroundColor: '#0B0B0E',
              padding: 12,
              height: 'calc(100vh - 38px)',
            }
          : {
              height: 'calc(100vh - 280px)',
              minHeight: 520,
            }),
      }}
    >
      {/* Top Studio Action Bar */}
      <div
        className="card"
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          backgroundColor: '#111115',
          border: '1px solid #25252D',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Folder size={17} color="#c084fc" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {project.title} &bull; {isRu ? 'Редактор кода' : 'Code Studio'}
          </span>
          {project.repo_path && (
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-dim)',
                background: 'rgba(255,255,255,0.05)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {project.repo_path}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Templates dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
              style={{ fontSize: '0.8rem' }}
            >
              <Sparkles size={14} color="#f59e0b" />
              {isRu ? 'Шаблоны' : 'Templates'}
            </button>

            {showTemplatesDropdown && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  zIndex: 50,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  minWidth: 220,
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {TEMPLATES.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleInsertTemplate(t)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 4,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(139,92,246,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span>{t.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{t.ext}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={triggerSave}
            style={{ fontSize: '0.8rem' }}
          >
            {isSavedRecently ? <Check size={14} color="#10b981" /> : <Save size={14} />}
            {isSavedRecently ? (isRu ? 'Сохранено!' : 'Saved!') : (isRu ? 'Сохранить (Ctrl+S)' : 'Save (Ctrl+S)')}
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={onOpenPreview}
            style={{ fontSize: '0.8rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <Play size={14} />
            {isRu ? 'Запустить превью' : 'Live Preview'}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onOpenGit}
            style={{ fontSize: '0.8rem' }}
          >
            <GitBranch size={14} color="#8B6CFF" />
            Git
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              backgroundColor: isFullscreen ? 'rgba(139, 108, 255, 0.18)' : '#16161C',
              border: `1px solid ${isFullscreen ? '#8B6CFF' : '#25252D'}`,
              borderRadius: 5,
              color: isFullscreen ? '#F1F1F5' : '#92929F',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={isFullscreen ? (isRu ? 'Выйти из полноэкранного режима (Esc / F11)' : 'Exit Fullscreen (Esc / F11)') : (isRu ? 'Открыть на весь экран (F11)' : 'Fullscreen (F11)')}
          >
            {isFullscreen ? <Minimize2 size={13} color="#8B6CFF" /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? (isRu ? 'Свернуть' : 'Exit') : (isRu ? 'Фулл экран' : 'Fullscreen')}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body: File Tree + Code Editor */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* Left Explorer Sidebar */}
        <div
          className="card"
          style={{
            width: 220,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {isRu ? 'Файлы проекта' : 'Project Files'}
            </span>
            <button
              className="btn-icon"
              style={{ width: 24, height: 24 }}
              onClick={() => setNewFileModalOpen(true)}
              title={isRu ? 'Создать файл' : 'New File'}
            >
              <FilePlus size={14} color="#a78bfa" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', flex: 1 }}>
            {files.map(file => {
              const isActive = file.id === (activeFile?.id || '');
              return (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                    border: isActive ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.82rem',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    {getFileIcon(file.name)}
                    <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {file.name}
                    </span>
                  </div>

                  {files.length > 1 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteFile(file.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: 2,
                        opacity: 0.6,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                      title={isRu ? 'Удалить файл' : 'Delete file'}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Editor Area */}
        <div
          className="card"
          style={{
            flex: 1,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#090812',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            overflow: 'hidden',
          }}
        >
          {/* File Tabs Bar */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderBottom: '1px solid var(--border-subtle)',
              overflowX: 'auto',
            }}
          >
            {files.map(file => {
              const isActive = file.id === (activeFile?.id || '');
              return (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file.id)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRight: '1px solid var(--border-subtle)',
                    borderBottom: isActive ? '2px solid #8b5cf6' : '2px solid transparent',
                    backgroundColor: isActive ? '#0e0c1b' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-dim)',
                  }}
                >
                  {getFileIcon(file.name)}
                  <span>{file.name}</span>
                </div>
              );
            })}
          </div>

          {/* Editor & Line Numbers */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Line numbers gutter */}
            <div
              style={{
                width: 48,
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                color: 'rgba(167, 139, 250, 0.4)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.82rem',
                lineHeight: '1.5rem',
                textAlign: 'right',
                padding: '12px 8px 12px 0',
                userSelect: 'none',
                overflowY: 'hidden',
              }}
            >
              {lineNumbers.map(n => (
                <div key={n}>{n}</div>
              ))}
            </div>

            {/* Code text editor */}
            <textarea
              ref={textareaRef}
              value={activeFile ? activeFile.content : ''}
              onChange={e => {
                if (activeFile) {
                  onUpdateFileContent(activeFile.id, e.target.value);
                }
              }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              wrap="off"
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                color: '#e2e8f0',
                fontFamily: 'var(--font-mono, "JetBrains Mono", Consolas, monospace)',
                fontSize: '0.84rem',
                lineHeight: '1.5rem',
                padding: '12px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                tabSize: 2,
                overflow: 'auto',
              }}
              placeholder={isRu ? '// Введите код здесь...' : '// Enter code here...'}
            />
          </div>

          {/* Bottom Editor Status Bar */}
          <div
            style={{
              padding: '6px 14px',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.74rem',
              color: 'var(--text-dim)',
            }}
          >
            <div style={{ display: 'flex', gap: 14 }}>
              <span>{activeFile?.path || activeFile?.name}</span>
              <span>{lineCount} {isRu ? 'строк' : 'lines'}</span>
              <span>{activeFile?.content.length || 0} {isRu ? 'симв.' : 'chars'}</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ color: '#8b5cf6', textTransform: 'uppercase', fontWeight: 600 }}>
                {activeFile?.language || 'text'}
              </span>
              <span>UTF-8</span>
              <span style={{ color: '#10b981' }}>● {isRu ? 'Автосохранение' : 'Auto-sync'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* New File Modal */}
      {isNewFileModalOpen && (
        <div className="modal-overlay" onClick={() => setNewFileModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">{isRu ? 'Создать новый файл' : 'Create New File'}</span>
              <button className="btn-icon" onClick={() => setNewFileModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateFileSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{isRu ? 'Имя файла' : 'File Name'}</label>
                  <input
                    type="text"
                    className="form-input"
                    autoFocus
                    placeholder="component.js, style.css, index.html"
                    value={newFileName}
                    onChange={e => setNewFileName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{isRu ? 'Тип файла' : 'File Type'}</label>
                  <select
                    className="form-select"
                    value={newFileLang}
                    onChange={e => setNewFileLang(e.target.value)}
                  >
                    <option value="javascript">JavaScript (.js)</option>
                    <option value="html">HTML (.html)</option>
                    <option value="css">CSS (.css)</option>
                    <option value="markdown">Markdown (.md)</option>
                    <option value="json">JSON (.json)</option>
                    <option value="python">Python (.py)</option>
                    <option value="rust">Rust (.rs)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setNewFileModalOpen(false)}>
                  {isRu ? 'Отмена' : 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary">
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
