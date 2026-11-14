import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  FileCode,
  Shield,
  Layers,
  CheckCircle2,
  Settings,
  Eye,
  Loader2,
  Cpu,
  X,
} from 'lucide-react';
import * as api from '../../api';
import type {
  Project,
  CodeFile,
  AIProviderConfig,
  AIPermissions,
  ProjectAIContext,
} from '../../types';
import { useApp } from '../../context/AppContext';
import { AIConfigModal } from './AIConfigModal';
import { AIContextModal } from './AIContextModal';
import { AIPermissionsModal } from './AIPermissionsModal';

interface AIAgentTabProps {
  project: Project;
  files: CodeFile[];
  onUpdateFiles: (files: CodeFile[]) => Promise<void>;
  onUpdateProject: (fields: Partial<Project>) => Promise<void>;
  isRu: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedChanges?: {
    filePath: string;
    newContent: string;
    applied?: boolean;
  }[];
}

export const AIAgentTab: React.FC<AIAgentTabProps> = ({
  project,
  files,
  onUpdateFiles,
  onUpdateProject,
  isRu,
}) => {
  const { addToast, showConfirm } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Modals
  const [isConfigModalOpen, setConfigModalOpen] = useState(false);
  const [isContextModalOpen, setContextModalOpen] = useState(false);
  const [isPermissionsModalOpen, setPermissionsModalOpen] = useState(false);

  // Active Provider
  const [activeProvider, setActiveProvider] = useState<AIProviderConfig | null>(null);

  // Diff inspection modal
  const [diffModalData, setDiffModalData] = useState<{
    filePath: string;
    oldContent: string;
    newContent: string;
    onApply: () => void;
  } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadActiveProvider();
    // Default select main files if available
    if (files.length > 0 && selectedFileIds.length === 0) {
      setSelectedFileIds(files.slice(0, 3).map(f => f.id));
    }
  }, [files]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const loadActiveProvider = async () => {
    try {
      const stored = await api.getAppSetting('ai_providers');
      if (stored) {
        const parsed: AIProviderConfig[] = JSON.parse(stored);
        const active = parsed.find(p => p.isActive) || parsed[0];
        setActiveProvider(active || null);
      }
    } catch {
      setActiveProvider(null);
    }
  };

  const handleToggleFileSelection = (id: string) => {
    setSelectedFileIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Helper to extract code blocks aimed at files: ```filepath:path/to/file or comments
  const parseSuggestedChanges = (content: string) => {
    const changes: { filePath: string; newContent: string }[] = [];
    const blockRegex = /```(?:[a-zA-Z0-9_\-]+)?\s*(?:filepath:|file:)?([a-zA-Z0-9_\-./\\]+)?\n([\s\S]*?)```/gi;
    let match;
    while ((match = blockRegex.exec(content)) !== null) {
      let declaredPath = match[1]?.trim();
      const code = match[2]?.trim();
      if (!declaredPath || declaredPath === 'typescript' || declaredPath === 'javascript' || declaredPath === 'html' || declaredPath === 'css' || declaredPath === 'json') {
        // Look inside first 3 lines of code for // File: or # File:
        const firstLines = code.split('\n').slice(0, 3).join('\n');
        const fileComment = /(?:\/\/|#|\/\*)\s*(?:file|path):\s*([a-zA-Z0-9_\-./\\]+)/i.exec(firstLines);
        if (fileComment && fileComment[1]) {
          declaredPath = fileComment[1].trim();
        }
      }

      if (declaredPath && code) {
        changes.push({
          filePath: declaredPath,
          newContent: code,
        });
      }
    }
    return changes;
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const text = customPrompt || inputText;
    if (!text.trim() || isThinking) return;

    if (!activeProvider) {
      addToast(
        isRu ? 'Настройте провайдер AI' : 'Configure AI Provider',
        isRu ? 'Перейдите в настройки провайдеров и укажите API ключ или Ollama' : 'Please configure an AI provider first',
        'warning'
      );
      setConfigModalOpen(true);
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    setIsThinking(true);

    try {
      // Build project context
      let aiContext: ProjectAIContext = {
        architecture: '',
        techStack: [],
        conventions: '',
        rules: '',
      };
      try {
        if (project.ai_context) {
          aiContext = JSON.parse(project.ai_context);
        }
      } catch {}

      // Build file tree representation
      const fileTree = files.map(f => `- ${f.path || f.name} (${f.language})`).join('\n');

      // Include selected file contents
      const selectedFilesContent = files
        .filter(f => selectedFileIds.includes(f.id))
        .map(f => `--- FILE: ${f.path || f.name} (${f.language}) ---\n${f.content}\n--- END FILE ---`)
        .join('\n\n');

      const systemPrompt = `You are NEXUS AI Agent, an expert autonomous software engineer and project assistant.
Project Name: ${project.title}
Description: ${project.description || 'No description provided'}
Tech Stack: ${aiContext.techStack.join(', ') || 'Not specified'}
Architecture Overview: ${aiContext.architecture || 'Standard modular architecture'}
Conventions: ${aiContext.conventions || 'Follow industry best practices, clean code and strict typing'}

Project Rules (.nexus/rules.md):
${aiContext.rules || 'Always produce robust, production-ready code.'}

Project File Tree:
${fileTree}

${selectedFilesContent ? `\nActive Selected Project Files:\n${selectedFilesContent}\n` : ''}

Instructions:
1. When generating or modifying code, provide the complete, functional code for that file.
2. Specify the exact target file path in the code block header or inside the first line, e.g.:
\`\`\`typescript filepath:src/App.tsx
// code here
\`\`\`
3. Keep explanations concise, professional and helpful. Support both Russian and English depending on user language.`;

      const response = await api.aiChat(
        activeProvider.provider,
        activeProvider.apiKey || '',
        activeProvider.defaultModel,
        activeProvider.endpoint,
        systemPrompt,
        text
      );

      const suggested = parseSuggestedChanges(response);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        content: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedChanges: suggested.length > 0 ? suggested : undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Log AI activity
      try {
        await api.logActivity(
          project.id,
          'ai_action',
          `AI (${activeProvider.name}): ${text.substring(0, 60)}...`,
          JSON.stringify({ model: activeProvider.defaultModel, promptLength: text.length })
        );
      } catch {}
    } catch (err: any) {
      addToast(
        isRu ? 'Ошибка генерации AI' : 'AI Generation Error',
        String(err),
        'error'
      );
      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        content: `${isRu ? 'Ошибка при запросе к AI' : 'Error querying AI'}: ${String(err)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleInspectDiff = (filePath: string, newContent: string) => {
    // Find current file
    const existing = files.find(f => f.path === filePath || f.name === filePath);
    const oldContent = existing ? existing.content : '';

    setDiffModalData({
      filePath,
      oldContent,
      newContent,
      onApply: () => applyCodeChange(filePath, newContent),
    });
  };

  const applyCodeChange = async (filePath: string, newContent: string) => {
    let permissions: AIPermissions = { fileWrite: 'ask', fileDelete: 'ask', terminalExec: 'ask' };
    try {
      if (project.ai_permissions) {
        permissions = JSON.parse(project.ai_permissions);
      }
    } catch {}

    if (permissions.fileWrite === 'deny') {
      addToast(
        isRu ? 'Действие заблокировано' : 'Action Denied',
        isRu ? 'В правах AI запрещено изменение файлов проекта.' : 'AI permissions deny file modifications.',
        'error'
      );
      return;
    }

    const doApply = async () => {
      try {
        // 1. Create a safety checkpoint before applying!
        await api.createCheckpoint(
          project.id,
          `Before AI Edit: ${filePath}`,
          `Automatic snapshot prior to applying AI changes to ${filePath}`,
          JSON.stringify(files)
        );

        // 2. Update files state
        const existingIndex = files.findIndex(f => f.path === filePath || f.name === filePath);
        let updatedFiles: CodeFile[];

        if (existingIndex >= 0) {
          updatedFiles = files.map((f, idx) =>
            idx === existingIndex ? { ...f, content: newContent } : f
          );
        } else {
          // New file
          const name = filePath.split(/[/\\]/).pop() || filePath;
          const ext = name.split('.').pop() || 'txt';
          const newFile: CodeFile = {
            id: `f-${Date.now()}`,
            name,
            path: filePath,
            language: ext === 'ts' || ext === 'tsx' ? 'typescript' : ext === 'js' || ext === 'jsx' ? 'javascript' : ext,
            content: newContent,
          };
          updatedFiles = [...files, newFile];
        }

        await onUpdateFiles(updatedFiles);

        // 3. Log activity
        await api.logActivity(
          project.id,
          'file_edit',
          `AI applied changes to ${filePath}`,
          JSON.stringify({ filePath, checkpointCreated: true })
        );

        addToast(
          isRu ? 'Изменения применены!' : 'Changes Applied!',
          `${filePath} (Чекпоинт сохранен)`,
          'success'
        );

        setDiffModalData(null);
      } catch (err: any) {
        addToast(isRu ? 'Ошибка' : 'Error', String(err), 'error');
      }
    };

    if (permissions.fileWrite === 'ask') {
      showConfirm(
        isRu ? `Применить изменения в ${filePath}?` : `Apply changes to ${filePath}?`,
        isRu
          ? 'Перед применением автоматически создается безопасный чекпоинт проекта для возможности отката.'
          : 'A safety project snapshot will be created before applying this change.',
        doApply
      );
    } else {
      await doApply();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        height: '100%',
        backgroundColor: '#0B0B0E',
        overflow: 'hidden',
      }}
    >
      {/* Left: Chat & Prompts */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #25252D',
          overflow: 'hidden',
        }}
      >
        {/* Top Control Bar */}
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#111115',
            borderBottom: '1px solid #25252D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          {/* Active Provider Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 5,
                fontSize: '0.74rem',
                color: activeProvider ? '#F1F1F5' : '#ef4444',
              }}
            >
              <Cpu size={14} color={activeProvider ? '#8B6CFF' : '#ef4444'} />
              <span>
                {activeProvider
                  ? `${activeProvider.name}: ${activeProvider.defaultModel}`
                  : isRu ? 'AI провайдер не выбран' : 'No AI provider'}
              </span>
            </div>

            <button
              onClick={() => setConfigModalOpen(true)}
              style={{
                background: 'transparent',
                border: '1px solid #25252D',
                borderRadius: 5,
                color: '#92929F',
                padding: '4px 8px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Settings size={13} />
              {isRu ? 'Провайдеры' : 'Providers'}
            </button>
          </div>

          {/* Context & Permissions Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setContextModalOpen(true)}
              style={{
                background: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 5,
                color: '#A78BFA',
                padding: '4px 10px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Layers size={13} />
              {isRu ? 'AI Контекст' : 'AI Context'}
            </button>

            <button
              onClick={() => setPermissionsModalOpen(true)}
              style={{
                background: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 5,
                color: '#92929F',
                padding: '4px 10px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Shield size={13} />
              {isRu ? 'Права AI' : 'Permissions'}
            </button>
          </div>
        </div>

        {/* Quick Action Pills */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#0B0B0E',
            borderBottom: '1px solid #25252D',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: '0.7rem', color: '#686877', whiteSpace: 'nowrap' }}>
            {isRu ? 'Действия:' : 'Actions:'}
          </span>
          <button
            onClick={() =>
              handleSendMessage(
                isRu
                  ? 'Проведи детальный архитектурный анализ проекта, выяви сильные и слабые стороны структуры.'
                  : 'Perform a detailed architectural analysis of this project, identifying design patterns and potential weaknesses.'
              )
            }
            style={{
              padding: '3px 9px',
              borderRadius: 4,
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              color: '#F1F1F5',
              fontSize: '0.7rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            💡 {isRu ? 'Анализ архитектуры' : 'Architecture Review'}
          </button>
          <button
            onClick={() =>
              handleSendMessage(
                isRu
                  ? 'Просканируй выбранные файлы на потенциальные баги, утечки памяти, неперехваченные ошибки и напиши исправления.'
                  : 'Scan selected files for potential bugs, unhandled errors, memory leaks and provide bugfixes.'
              )
            }
            style={{
              padding: '3px 9px',
              borderRadius: 4,
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              color: '#F1F1F5',
              fontSize: '0.7rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            🐛 {isRu ? 'Поиск багов' : 'Bug Finder'}
          </button>
          <button
            onClick={() =>
              handleSendMessage(
                isRu
                  ? 'Сделай рефакторинг выбранных файлов: улучши читаемость, разбей на чистые функции, оптимизируй типизацию.'
                  : 'Refactor selected files: improve modularity, simplify functions, and optimize typing.'
              )
            }
            style={{
              padding: '3px 9px',
              borderRadius: 4,
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              color: '#F1F1F5',
              fontSize: '0.7rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            🔄 {isRu ? 'Рефакторинг' : 'Refactoring'}
          </button>
          <button
            onClick={() =>
              handleSendMessage(
                isRu
                  ? 'Сгенерируй исчерпывающую техническую документацию README.md для проекта с описанием установки, API и структуры.'
                  : 'Generate a comprehensive technical README.md documentation for this project including setup and API.'
              )
            }
            style={{
              padding: '3px 9px',
              borderRadius: 4,
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              color: '#F1F1F5',
              fontSize: '0.7rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            📖 {isRu ? 'Документация' : 'Docs Generator'}
          </button>
        </div>

        {/* Message Log */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                maxWidth: 420,
                color: '#686877',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  backgroundColor: 'rgba(139, 108, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8B6CFF',
                  margin: '0 auto 14px',
                  border: '1px solid rgba(139, 108, 255, 0.2)',
                }}
              >
                <Bot size={26} />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', color: '#F1F1F5' }}>
                {isRu ? 'AI Ассистент Проекта' : 'Project AI Agent'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.5 }}>
                {isRu
                  ? 'Агент анализирует структуру файлов проекта, создает новые компоненты, правит баги и проводит рефакторинг с безопасным созданием чекпоинтов.'
                  : 'The agent analyzes project source files, implements features, fixes bugs, and performs refactoring with automated rollback snapshots.'}
              </p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                    fontSize: '0.68rem',
                    color: '#686877',
                  }}
                >
                  <span>{msg.sender === 'user' ? (isRu ? 'Вы' : 'You') : 'NEXUS Agent'}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  style={{
                    maxWidth: '88%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: msg.sender === 'user' ? 'rgba(139, 108, 255, 0.12)' : '#16161C',
                    border: `1px solid ${msg.sender === 'user' ? 'rgba(139, 108, 255, 0.3)' : '#25252D'}`,
                    color: '#F1F1F5',
                    fontSize: '0.82rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}

                  {/* Suggested changes badges */}
                  {msg.suggestedChanges && msg.suggestedChanges.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: '1px solid #25252D',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#A78BFA' }}>
                        {isRu ? 'Предложенные изменения в коде:' : 'Proposed Code Changes:'}
                      </span>
                      {msg.suggestedChanges.map((change, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            backgroundColor: '#0B0B0E',
                            border: '1px solid #25252D',
                            borderRadius: 5,
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <FileCode size={14} color="#8B6CFF" />
                            <span
                              style={{
                                fontSize: '0.74rem',
                                color: '#F1F1F5',
                                fontFamily: 'monospace',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                              }}
                            >
                              {change.filePath}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => handleInspectDiff(change.filePath, change.newContent)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                backgroundColor: 'rgba(139, 108, 255, 0.15)',
                                border: '1px solid rgba(139, 108, 255, 0.3)',
                                borderRadius: 4,
                                color: '#A78BFA',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                              }}
                            >
                              <Eye size={12} />
                              {isRu ? 'Diff' : 'Diff'}
                            </button>

                            <button
                              onClick={() => applyCodeChange(change.filePath, change.newContent)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 9px',
                                backgroundColor: '#8B6CFF',
                                border: 'none',
                                borderRadius: 4,
                                color: '#0B0B0E',
                                fontWeight: 600,
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                              }}
                            >
                              <CheckCircle2 size={12} />
                              {isRu ? 'Применить' : 'Apply'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isThinking && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 8,
                color: '#92929F',
                fontSize: '0.78rem',
                maxWidth: 240,
              }}
            >
              <Loader2 size={16} className="spin" color="#8B6CFF" />
              <span>{isRu ? 'AI анализирует проект...' : 'AI is thinking...'}</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: 12,
            backgroundColor: '#111115',
            borderTop: '1px solid #25252D',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 8,
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              borderRadius: 6,
              padding: '6px 10px',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isRu
                  ? 'Задайте задачу AI Агенту (например: добавь компонент модального окна)...'
                  : 'Ask AI Agent (e.g., implement a reusable modal component)...'
              }
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                color: '#F1F1F5',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={isThinking || !inputText.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30,
                height: 30,
                backgroundColor: inputText.trim() ? '#8B6CFF' : '#25252D',
                border: 'none',
                borderRadius: 4,
                color: inputText.trim() ? '#0B0B0E' : '#686877',
                cursor: inputText.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Context Files Selection */}
      <div
        style={{
          width: 240,
          backgroundColor: '#111115',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid #25252D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#F1F1F5' }}>
            {isRu ? 'Файлы в контексте' : 'Context Files'}
          </span>
          <span style={{ fontSize: '0.68rem', color: '#8B6CFF' }}>
            {selectedFileIds.length}/{files.length}
          </span>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {files.length === 0 ? (
            <div style={{ fontSize: '0.72rem', color: '#686877', padding: 8 }}>
              {isRu ? 'В проекте пока нет файлов' : 'No files in project yet'}
            </div>
          ) : (
            files.map(file => {
              const isSelected = selectedFileIds.includes(file.id);
              return (
                <div
                  key={file.id}
                  onClick={() => handleToggleFileSelection(file.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(139, 108, 255, 0.1)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(139, 108, 255, 0.3)' : 'transparent'}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by parent onClick
                    style={{
                      accentColor: '#8B6CFF',
                      cursor: 'pointer',
                    }}
                  />
                  <FileCode size={14} color={isSelected ? '#8B6CFF' : '#686877'} />
                  <span
                    style={{
                      fontSize: '0.74rem',
                      color: isSelected ? '#F1F1F5' : '#92929F',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {file.name}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Diff Inspection Modal */}
      {diffModalData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 24,
          }}
          onClick={() => setDiffModalData(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 900,
              height: '80vh',
              backgroundColor: '#111115',
              border: '1px solid #25252D',
              borderRadius: 8,
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Diff Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #25252D',
                backgroundColor: '#0B0B0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={16} color="#8B6CFF" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#F1F1F5' }}>
                  {isRu ? 'Просмотр Diff' : 'Diff Preview'}: {diffModalData.filePath}
                </span>
              </div>
              <button
                onClick={() => setDiffModalData(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#92929F',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Diff Body: Side-by-side view */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Old Content */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: '1px solid #25252D',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#16161C',
                    fontSize: '0.7rem',
                    color: '#ef4444',
                    borderBottom: '1px solid #25252D',
                  }}
                >
                  {isRu ? 'Текущая версия файла' : 'Current File Version'}
                </div>
                <pre
                  style={{
                    flex: 1,
                    margin: 0,
                    padding: 12,
                    overflow: 'auto',
                    backgroundColor: '#0B0B0E',
                    color: '#92929F',
                    fontSize: '0.74rem',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                  }}
                >
                  {diffModalData.oldContent || (isRu ? '(Файл еще не существует)' : '(New file)')}
                </pre>
              </div>

              {/* New Content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#16161C',
                    fontSize: '0.7rem',
                    color: '#10b981',
                    borderBottom: '1px solid #25252D',
                  }}
                >
                  {isRu ? 'Предложение AI' : 'AI Proposed Code'}
                </div>
                <pre
                  style={{
                    flex: 1,
                    margin: 0,
                    padding: 12,
                    overflow: 'auto',
                    backgroundColor: '#0B0B0E',
                    color: '#F1F1F5',
                    fontSize: '0.74rem',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                  }}
                >
                  {diffModalData.newContent}
                </pre>
              </div>
            </div>

            {/* Diff Footer */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #25252D',
                backgroundColor: '#0B0B0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#686877' }}>
                {isRu
                  ? 'При применении будет автоматически сохранен снимок (чекпоинт).'
                  : 'An automatic checkpoint snapshot will be captured on apply.'}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setDiffModalData(null)}
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
                  onClick={diffModalData.onApply}
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
                  <CheckCircle2 size={14} />
                  {isRu ? 'Применить изменения' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Config Modal */}
      <AIConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => {
          setConfigModalOpen(false);
          loadActiveProvider();
        }}
        isRu={isRu}
      />

      {/* AI Context Modal */}
      <AIContextModal
        isOpen={isContextModalOpen}
        onClose={() => setContextModalOpen(false)}
        project={project}
        onSaveContext={async ctx => {
          const stringified = JSON.stringify(ctx);
          await onUpdateProject({ ai_context: stringified });
          addToast(isRu ? 'AI Контекст обновлен' : 'AI Context updated', '', 'success');
        }}
        isRu={isRu}
      />

      {/* AI Permissions Modal */}
      <AIPermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setPermissionsModalOpen(false)}
        project={project}
        onSavePermissions={async perms => {
          const stringified = JSON.stringify(perms);
          await onUpdateProject({ ai_permissions: stringified });
          addToast(isRu ? 'Права AI обновлены' : 'AI Permissions updated', '', 'success');
        }}
        isRu={isRu}
      />
    </div>
  );
};
