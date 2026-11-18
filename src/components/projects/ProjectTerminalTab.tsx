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
  const inputRef = useRef<HTMLInputElement>(null);

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
      setTimeout(() => inputRef.current?.focus(), 50);
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
        color: '#F1F1F5',
        overflow: 'hidden',
        transition: 'all 0.15s ease',
        ...(isFullscreen
          ? {
              position: 'fixed',
              top: 38,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              width: '100vw',
              height: 'calc(100vh - 38px)',
              borderRadius: 0,
              border: 'none',
            }
          : {
              height: 'calc(100vh - 215px)',
              minHeight: 560,
              borderRadius: 8,
              border: '1px solid #25252D',
            }),
      }}
    >
      {/* VS Code Terminal Header */}
      <div
        style={{
          height: 36,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Active Tab */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.74rem',
              fontWeight: 700,
              color: '#F1F1F5',
              borderBottom: '2px solid #8B6CFF',
              padding: '8px 0',
              letterSpacing: 0.5,
            }}
          >
            <TerminalIcon size={13} color="#8B6CFF" />
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#686877', fontSize: '0.74rem' }}>
            <Folder size={12} />
            <span style={{ fontFamily: 'var(--font-mono)' }}>{projectDir}</span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {history.length > 0 && (
            <button
              type="button"
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
                padding: '3px 6px',
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
              padding: '4px 10px',
              backgroundColor: isFullscreen ? 'rgba(139, 108, 255, 0.25)' : '#16161C',
              border: `1px solid ${isFullscreen ? '#8B6CFF' : '#25252D'}`,
              borderRadius: 4,
              color: isFullscreen ? '#F1F1F5' : '#92929F',
              cursor: 'pointer',
              fontSize: '0.74rem',
              fontWeight: 600,
            }}
            title={
              isFullscreen
                ? isRu
                  ? 'Выйти из полноэкранного режима (Esc / F11)'
                  : 'Exit Fullscreen (Esc / F11)'
                : isRu
                ? 'На весь экран (F11)'
                : 'Fullscreen Terminal (F11)'
            }
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
          padding: '6px 12px',
          backgroundColor: '#111115',
          borderBottom: '1px solid #25252D',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '0.68rem', color: '#686877', alignSelf: 'center', marginRight: 4 }}>
          {isRu ? 'Быстрые команды:' : 'Presets:'}
        </span>
        {presets.map(p => (
          <button
            key={p}
            onClick={() => handleRunCommand(p)}
            disabled={isRunning}
            style={{
              padding: '2px 8px',
              backgroundColor: '#16161C',
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
          fontFamily: 'var(--font-mono, "JetBrains Mono", Consolas, monospace)',
          fontSize: '0.82rem',
          lineHeight: 1.55,
          color: '#F1F1F5',
          backgroundColor: '#0B0B0E',
        }}
      >
        <div style={{ color: '#686877', marginBottom: 14 }}>
          Windows PowerShell [NEXUS Terminal Session initialized in {projectDir}]<br />
          {isRu ? 'Введите команду ниже или выберите пресет.' : 'Type a command below or choose a preset.'}
        </div>

        {history.map(item => (
          <div key={item.id} style={{ marginBottom: 14 }}>
            {/* Prompt line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A78BFA' }}>
              <span style={{ color: '#38bdf8' }}>PS {projectDir}&gt;</span>
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
                  color: '#e2e8f0',
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
                  color: '#ef4444',
                  fontFamily: 'inherit',
                }}
              >
                {item.stderr}
              </pre>
            )}
          </div>
        ))}

        {isRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8B6CFF', margin: '8px 0' }}>
            <RotateCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
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
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>PS&gt;</span>
        <input
          ref={inputRef}
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
            padding: '5px 14px',
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

      {/* VS Code Bottom Status Bar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <TerminalIcon size={11} color="#8B6CFF" />
            <span>PowerShell 7.x (x64)</span>
          </div>
          <span>UTF-8</span>
          <span style={{ color: '#10b981' }}>Ready</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{history.length} {isRu ? 'команд' : 'commands'}</span>
          <span>F11: Fullscreen</span>
        </div>
      </div>
    </div>
  );
};