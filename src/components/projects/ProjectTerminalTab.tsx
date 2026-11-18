import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  Trash2,
  Folder,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import * as api from '../../api';
import type { Project } from '../../types';

interface ProjectTerminalTabProps {
  project: Project;
  isRu: boolean;
}

interface CommandHistoryItem {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timestamp: string;
}

export const ProjectTerminalTab: React.FC<ProjectTerminalTabProps> = ({
  project,
  isRu,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const outputEndRef = useRef<HTMLDivElement>(null);

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

  const projectDir = project.repo_path || 'C:\\Workspace\\' + project.title;

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleRunCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || commandInput).trim();
    if (!cmd || isRunning) return;

    setIsRunning(true);
    setCommandInput('');
    setHistoryIdx(-1);

    const now = new Date().toLocaleTimeString();

    try {
      const res = await api.runProjectTerminal(project.repo_path, cmd);
      const item: CommandHistoryItem = {
        id: `term-${Date.now()}`,
        command: cmd,
        stdout: res.stdout,
        stderr: res.stderr,
        exitCode: res.exit_code,
        durationMs: res.duration_ms,
        timestamp: now,
      };

      setHistory(prev => [...prev, item]);
      api.logActivity(project.id, 'terminal', `Команда терминала: ${cmd}`, `exit: ${res.exit_code}`);
    } catch (err: any) {
      setHistory(prev => [
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
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRunCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(nextIdx);
        setCommandInput(history[nextIdx].command);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx !== -1) {
        const nextIdx = historyIdx + 1;
        if (nextIdx < history.length) {
          setHistoryIdx(nextIdx);
          setCommandInput(history[nextIdx].command);
        } else {
          setHistoryIdx(-1);
          setCommandInput('');
        }
      }
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const presets = [
    'git status',
    'git log -n 5 --oneline',
    'npm run dev',
    'npm install',
    'dir',
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0B0B0E',
        border: isFullscreen ? 'none' : '1px solid #25252D',
        borderRadius: isFullscreen ? 0 : 8,
        overflow: 'hidden',
        transition: 'all 0.18s ease',
        ...(isFullscreen
          ? {
              position: 'fixed',
              top: 38,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 900,
              height: 'calc(100vh - 38px)',
            }
          : {
              height: 'calc(100vh - 165px)',
            }),
      }}
    >
      {/* Terminal Top Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 14px',
          backgroundColor: '#111115',
          borderBottom: '1px solid #25252D',
          fontSize: '0.78rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92929F' }}>
          <TerminalIcon size={14} color="#8B6CFF" />
          <span style={{ fontWeight: 600, color: '#F1F1F5' }}>PowerShell Terminal</span>
          <span style={{ color: '#25252D' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#686877' }}>
            <Folder size={12} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>{projectDir}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#686877',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.72rem',
              }}
              title={isRu ? 'Очистить вывод' : 'Clear console'}
            >
              <Trash2 size={12} />
              <span>{isRu ? 'Очистить' : 'Clear'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 9px',
              backgroundColor: isFullscreen ? 'rgba(139, 108, 255, 0.18)' : '#16161C',
              border: `1px solid ${isFullscreen ? '#8B6CFF' : '#25252D'}`,
              borderRadius: 4,
              color: isFullscreen ? '#F1F1F5' : '#92929F',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
            title={isFullscreen ? (isRu ? 'Выйти из полноэкранного режима (Esc / F11)' : 'Exit Fullscreen (Esc / F11)') : (isRu ? 'Открыть на весь экран (F11)' : 'Fullscreen (F11)')}
          >
            {isFullscreen ? <Minimize2 size={12} color="#8B6CFF" /> : <Maximize2 size={12} />}
            <span>{isFullscreen ? (isRu ? 'Свернуть' : 'Exit') : (isRu ? 'Фулл экран' : 'Fullscreen')}</span>
          </button>
        </div>
      </div>

      {/* Preset Quick Chips */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '6px 14px',
          backgroundColor: '#16161C',
          borderBottom: '1px solid #25252D',
          overflowX: 'auto',
        }}
      >
        <span style={{ fontSize: '0.7rem', color: '#686877', alignSelf: 'center', marginRight: 4 }}>
          {isRu ? 'Быстрые команды:' : 'Presets:'}
        </span>
        {presets.map(p => (
          <button
            key={p}
            onClick={() => handleRunCommand(p)}
            disabled={isRunning}
            style={{
              padding: '2px 8px',
              backgroundColor: '#111115',
              border: '1px solid #25252D',
              borderRadius: 4,
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              color: '#92929F',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#8B6CFF';
              e.currentTarget.style.color = '#F1F1F5';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#25252D';
              e.currentTarget.style.color = '#92929F';
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Output Console Log Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 14,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          lineHeight: 1.5,
          color: '#F1F1F5',
          backgroundColor: '#0B0B0E',
        }}
      >
        {history.length === 0 ? (
          <div style={{ color: '#686877', fontStyle: 'italic', padding: '12px 0' }}>
            NEXUS Terminal Session initialized in {projectDir}.<br />
            {isRu ? 'Введите команду ниже или выберите шаблон.' : 'Type a command below or select a preset.'}
          </div>
        ) : (
          history.map(item => (
            <div key={item.id} style={{ marginBottom: 16 }}>
              {/* Prompt line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A78BFA' }}>
                <span style={{ color: '#8B6CFF', fontWeight: 700 }}>&gt;</span>
                <span style={{ fontWeight: 600, color: '#F1F1F5' }}>{item.command}</span>
                <span style={{ fontSize: '0.7rem', color: '#686877', marginLeft: 'auto' }}>
                  {item.timestamp} &bull; {item.durationMs}ms
                </span>
                {item.exitCode === 0 ? (
                  <CheckCircle2 size={12} color="#10b981" />
                ) : (
                  <AlertCircle size={12} color="#ef4444" />
                )}
              </div>

              {/* Stdout */}
              {item.stdout && (
                <pre
                  style={{
                    margin: '4px 0 0 16px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: '#92929F',
                    fontFamily: 'inherit',
                  }}
                >
                  {item.stdout}
                </pre>
              )}

              {/* Stderr */}
              {item.stderr && (
                <pre
                  style={{
                    margin: '4px 0 0 16px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    color: '#f87171',
                    fontFamily: 'inherit',
                  }}
                >
                  {item.stderr}
                </pre>
              )}
            </div>
          ))
        )}

        {isRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B6CFF', margin: '8px 0' }}>
            <RotateCw size={13} className="spin-slow" />
            <span>{isRu ? 'Выполнение команды...' : 'Executing command...'}</span>
          </div>
        )}

        <div ref={outputEndRef} />
      </div>

      {/* Input Line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          backgroundColor: '#111115',
          borderTop: '1px solid #25252D',
        }}
      >
        <span style={{ color: '#8B6CFF', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>$</span>
        <input
          type="text"
          value={commandInput}
          onChange={e => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder={isRu ? 'Введите команду (Enter для выполнения)...' : 'Type command here (Press Enter)...'}
          style={{
            flex: 1,
            height: 32,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#F1F1F5',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.84rem',
          }}
          autoFocus
        />

        <button
          onClick={() => handleRunCommand()}
          disabled={isRunning || !commandInput.trim()}
          style={{
            padding: '4px 12px',
            backgroundColor: commandInput.trim() ? '#8B6CFF' : 'transparent',
            border: '1px solid #25252D',
            borderRadius: 5,
            color: commandInput.trim() ? '#fff' : '#686877',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: commandInput.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Play size={11} />
          <span>{isRu ? 'Выполнить' : 'Run'}</span>
        </button>
      </div>
    </div>
  );
};
