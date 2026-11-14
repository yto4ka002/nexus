import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Terminal,
  Trash2,
  Send,
  Code,
  Globe,
} from 'lucide-react';
import type { Project, CodeFile } from '../../types';
import { useApp } from '../../context/AppContext';
import * as api from '../../api';

interface LivePreviewTabProps {
  project: Project;
  files: CodeFile[];
  onSwitchToCode: () => void;
}

interface ConsoleLogItem {
  id: string;
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export const LivePreviewTab: React.FC<LivePreviewTabProps> = ({
  project: _project,
  files,
  onSwitchToCode,
}) => {
  const { language, addToast } = useApp();
  const isRu = language === 'ru';

  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogItem[]>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString(),
      level: 'info',
      message: isRu ? 'NEXUS Live Preview Runtime активирован.' : 'NEXUS Live Preview Runtime active.',
    },
  ]);
  const [evalInput, setEvalInput] = useState('');
  const [devServerUrl, setDevServerUrl] = useState('http://localhost:3000');
  const [isUsingDevServer, setIsUsingDevServer] = useState(false);
  const [serverPingStatus, setServerPingStatus] = useState<'idle' | 'online' | 'offline'>('idle');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Listen to messages from the preview iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'NEXUS_CONSOLE_LOG') {
        const item: ConsoleLogItem = {
          id: `log-${Date.now()}-${Math.random()}`,
          time: new Date().toLocaleTimeString(),
          level: e.data.level || 'info',
          message: e.data.message || '',
        };
        setConsoleLogs(prev => [...prev.slice(-100), item]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  // Generate dynamic srcDoc
  const generateSrcDoc = () => {
    const htmlFile = files.find(f => f.name.endsWith('.html')) || { content: '<div style="padding: 20px; font-family: sans-serif;"><h1>No HTML file found</h1></div>' };
    const cssFiles = files.filter(f => f.name.endsWith('.css'));
    const jsFiles = files.filter(f => f.name.endsWith('.js'));

    const cssBundle = cssFiles.map(c => c.content).join('\n\n');
    const jsBundle = jsFiles.map(j => j.content).join('\n\n');

    // Console hook script injected into head
    const hookScript = `
      <script>
        (function() {
          const sendLog = (level, args) => {
            try {
              const msg = Array.from(args).map(a => {
                if (typeof a === 'object') {
                  try { return JSON.stringify(a); } catch(e) { return String(a); }
                }
                return String(a);
              }).join(' ');
              window.parent.postMessage({ type: 'NEXUS_CONSOLE_LOG', level: level, message: msg }, '*');
            } catch(err) {}
          };
          const _log = console.log;
          const _warn = console.warn;
          const _error = console.error;
          console.log = function(...args) { _log.apply(console, args); sendLog('info', args); };
          console.warn = function(...args) { _warn.apply(console, args); sendLog('warn', args); };
          console.error = function(...args) { _error.apply(console, args); sendLog('error', args); };
          window.onerror = function(msg, url, line) {
            sendLog('error', ['Uncaught Exception: ' + msg + ' (line ' + line + ')']);
          };
        })();
      </script>
    `;

    let html = htmlFile.content;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${hookScript}<style>${cssBundle}</style></head>`);
    } else {
      html = `${hookScript}<style>${cssBundle}</style>${html}`;
    }

    if (html.includes('</body>')) {
      html = html.replace('</body>', `<script>${jsBundle}</script></body>`);
    } else {
      html = `${html}<script>${jsBundle}</script>`;
    }

    return html;
  };

  const handleRefresh = () => {
    setReloadKey(prev => prev + 1);
    addToast(isRu ? 'Превью обновлено' : 'Preview Refreshed', '', 'info');
  };

  const handleCheckDevServer = async () => {
    setServerPingStatus('idle');
    try {
      const isAlive = await api.pingDevServer(devServerUrl);
      if (isAlive) {
        setServerPingStatus('online');
        addToast(isRu ? 'Сервер доступен' : 'Server Online', devServerUrl, 'success');
      } else {
        setServerPingStatus('offline');
        addToast(isRu ? 'Сервер не отвечает' : 'Server Unreachable', devServerUrl, 'warning');
      }
    } catch {
      setServerPingStatus('offline');
    }
  };

  const handleOpenExternal = () => {
    if (isUsingDevServer) {
      api.launchTarget(devServerUrl);
    } else {
      // Create a temporary Blob URL and launch
      const blob = new Blob([generateSrcDoc()], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      api.launchTarget(url);
    }
  };

  const handleEvalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalInput.trim()) return;

    const command = evalInput.trim();
    setConsoleLogs(prev => [
      ...prev,
      {
        id: `cli-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        level: 'info',
        message: `> ${command}`,
      },
    ]);

    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const result = (iframeRef.current.contentWindow as any).eval(command);
        if (result !== undefined) {
          setConsoleLogs(prev => [
            ...prev,
            {
              id: `res-${Date.now()}`,
              time: new Date().toLocaleTimeString(),
              level: 'info',
              message: `< ${typeof result === 'object' ? JSON.stringify(result) : String(result)}`,
            },
          ]);
        }
      }
    } catch (err: any) {
      setConsoleLogs(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          level: 'error',
          message: `< Error: ${err.message || String(err)}`,
        },
      ]);
    }
    setEvalInput('');
  };

  const getViewportWidth = () => {
    switch (viewport) {
      case 'mobile': return 375;
      case 'tablet': return 768;
      default: return '100%';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: 'calc(100vh - 300px)',
        minHeight: 520,
      }}
    >
      {/* Top Preview Controls Bar */}
      <div
        className="card"
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        {/* Viewport switchers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
            {isRu ? 'Вьюпорт:' : 'Viewport:'}
          </span>
          <button
            className={`btn btn-sm ${viewport === 'desktop' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewport('desktop')}
            title="Desktop (100%)"
          >
            <Monitor size={14} />
            <span style={{ fontSize: '0.78rem' }}>100%</span>
          </button>
          <button
            className={`btn btn-sm ${viewport === 'tablet' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewport('tablet')}
            title="Tablet (768px)"
          >
            <Tablet size={14} />
            <span style={{ fontSize: '0.78rem' }}>768px</span>
          </button>
          <button
            className={`btn btn-sm ${viewport === 'mobile' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewport('mobile')}
            title="Mobile (375px)"
          >
            <Smartphone size={14} />
            <span style={{ fontSize: '0.78rem' }}>375px</span>
          </button>
        </div>

        {/* Dev server controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '2px 8px',
              gap: 6,
            }}
          >
            <Globe size={13} color="var(--accent-secondary)" />
            <input
              type="text"
              value={devServerUrl}
              onChange={e => setDevServerUrl(e.target.value)}
              placeholder="http://localhost:3000"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                width: 150,
                outline: 'none',
              }}
            />
            <button
              onClick={handleCheckDevServer}
              style={{
                background: 'transparent',
                border: 'none',
                color: serverPingStatus === 'online' ? '#10b981' : serverPingStatus === 'offline' ? '#ef4444' : 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              {serverPingStatus === 'online' ? '● Live' : serverPingStatus === 'offline' ? '● Off' : 'Ping'}
            </button>
          </div>

          <button
            className={`btn btn-sm ${isUsingDevServer ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsUsingDevServer(!isUsingDevServer)}
            style={{ fontSize: '0.78rem' }}
          >
            {isUsingDevServer ? (isRu ? 'Сервер' : 'Dev Server') : (isRu ? 'Код' : 'Bundled')}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} title={isRu ? 'Обновить' : 'Reload'}>
            <RefreshCw size={14} />
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleOpenExternal} title={isRu ? 'Открыть в браузере' : 'Open in Browser'}>
            <ExternalLink size={14} />
          </button>

          <button className="btn btn-secondary btn-sm" onClick={onSwitchToCode}>
            <Code size={14} color="#a78bfa" />
            <span style={{ fontSize: '0.78rem' }}>{isRu ? 'К коду' : 'Edit Code'}</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Container & Frame */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: '#07060c',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: getViewportWidth(),
            height: '100%',
            transition: 'width 0.25s ease',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#000',
            boxShadow: viewport !== 'desktop' ? '0 0 35px rgba(0,0,0,0.8), 0 0 15px rgba(139,92,246,0.3)' : 'none',
            border: viewport !== 'desktop' ? '2px solid rgba(139, 92, 246, 0.4)' : 'none',
            borderRadius: viewport === 'mobile' ? '24px' : viewport === 'tablet' ? '16px' : '0px',
            overflow: 'hidden',
          }}
        >
          {viewport === 'mobile' && (
            <div
              style={{
                height: 24,
                backgroundColor: '#11101b',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: '#333' }} />
            </div>
          )}

          <iframe
            key={reloadKey}
            ref={iframeRef}
            srcDoc={isUsingDevServer ? undefined : generateSrcDoc()}
            src={isUsingDevServer ? devServerUrl : undefined}
            title="NEXUS Live Preview"
            sandbox="allow-scripts allow-modals allow-same-origin"
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              backgroundColor: '#fff',
            }}
          />
        </div>
      </div>

      {/* Interactive Developer Console Drawer */}
      <div
        className="card"
        style={{
          height: 140,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0a0814',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Console Header */}
        <div
          style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={14} color="#a855f7" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isRu ? 'Консоль логов' : 'Developer Console'}
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                color: '#c084fc',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700,
              }}
            >
              {consoleLogs.length}
            </span>
          </div>

          <button
            onClick={() => setConsoleLogs([])}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Trash2 size={12} />
            {isRu ? 'Очистить' : 'Clear'}
          </button>
        </div>

        {/* Logs Feed */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px 12px',
            fontFamily: 'var(--font-mono, "JetBrains Mono", Consolas, monospace)',
            fontSize: '0.76rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {consoleLogs.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                color: item.level === 'error' ? '#f87171' : item.level === 'warn' ? '#fde047' : '#93c5fd',
              }}
            >
              <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>[{item.time}]</span>
              <span style={{ fontWeight: 700, fontSize: '0.7rem' }}>[{item.level.toUpperCase()}]</span>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{item.message}</span>
            </div>
          ))}
          <div ref={consoleBottomRef} />
        </div>

        {/* Live Evaluation Input */}
        <form
          onSubmit={handleEvalSubmit}
          style={{
            display: 'flex',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <span style={{ padding: '6px 8px', color: '#8b5cf6', fontFamily: 'monospace', fontWeight: 700 }}>&gt;</span>
          <input
            type="text"
            value={evalInput}
            onChange={e => setEvalInput(e.target.value)}
            placeholder={isRu ? 'Выполнить JavaScript в превью (например: alert("OK") или document.title)...' : 'Evaluate JavaScript in preview...'}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '0.76rem',
              fontFamily: 'var(--font-mono, monospace)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b5cf6',
              padding: '0 12px',
              cursor: 'pointer',
            }}
          >
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
};
