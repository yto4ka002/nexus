import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  Plus,
  Save,
  Sparkles,
  Eye,
  Edit3,
  Columns,
  Loader2,
} from 'lucide-react';
import type { Project, CodeFile, AIProviderConfig } from '../../types';
import * as api from '../../api';
import { useApp } from '../../context/AppContext';

interface ProjectDocsTabProps {
  project: Project;
  files: CodeFile[];
  onUpdateFiles: (files: CodeFile[]) => Promise<void>;
  isRu: boolean;
}

export const ProjectDocsTab: React.FC<ProjectDocsTabProps> = ({
  project,
  files,
  onUpdateFiles,
  isRu,
}) => {
  const { addToast } = useApp();

  // Find or create docs files (e.g. *.md)
  const docFiles = files.filter(
    f => f.name.toLowerCase().endsWith('.md') || f.name.toLowerCase().endsWith('.markdown')
  );

  const [activeDocId, setActiveDocId] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [isGenerating, setIsGenerating] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  useEffect(() => {
    if (docFiles.length > 0) {
      const current = docFiles.find(f => f.id === activeDocId) || docFiles[0];
      setActiveDocId(current.id);
      setDocContent(current.content);
    } else {
      setActiveDocId('');
      setDocContent('');
    }
  }, [files]);

  const activeDoc = docFiles.find(f => f.id === activeDocId);

  const handleSelectDoc = (id: string) => {
    setActiveDocId(id);
    const found = docFiles.find(f => f.id === id);
    if (found) {
      setDocContent(found.content);
    }
  };

  const handleSaveDoc = async () => {
    if (!activeDoc) return;
    try {
      const updated = files.map(f => (f.id === activeDoc.id ? { ...f, content: docContent } : f));
      await onUpdateFiles(updated);
      addToast(isRu ? 'Документ сохранен' : 'Document saved', activeDoc.name, 'success');
      await api.logActivity(project.id, 'file_edit', `Updated doc: ${activeDoc.name}`);
    } catch (err: any) {
      addToast(isRu ? 'Ошибка сохранения' : 'Save Error', String(err), 'error');
    }
  };

  const handleCreateNewDoc = async () => {
    if (!newDocName.trim()) return;
    let fileName = newDocName.trim();
    if (!fileName.endsWith('.md')) fileName += '.md';

    const newFile: CodeFile = {
      id: `doc-${Date.now()}`,
      name: fileName,
      path: `docs/${fileName}`,
      language: 'markdown',
      content: `# ${fileName.replace('.md', '')}\n\nTechnical documentation for ${project.title}.\n`,
    };

    const updated = [...files, newFile];
    await onUpdateFiles(updated);
    setActiveDocId(newFile.id);
    setDocContent(newFile.content);
    setNewDocName('');
    setIsCreatingNew(false);
    addToast(isRu ? 'Документ создан' : 'Document created', fileName, 'success');
  };

  const handleAiGenerateDocs = async (promptType: 'readme' | 'architecture' | 'api') => {
    setIsGenerating(true);
    try {
      let activeProvider: AIProviderConfig | null = null;
      try {
        const stored = await api.getAppSetting('ai_providers');
        if (stored) {
          const parsed: AIProviderConfig[] = JSON.parse(stored);
          activeProvider = parsed.find(p => p.isActive) || parsed[0];
        }
      } catch {}

      if (!activeProvider) {
        addToast(
          isRu ? 'Настройте AI провайдер' : 'Configure AI Provider',
          isRu ? 'Вам необходимо настроить провайдер AI в настройках' : 'Please configure an AI provider first',
          'warning'
        );
        return;
      }

      const fileList = files.map(f => `- ${f.path || f.name} (${f.language})`).join('\n');
      const sampleCode = files
        .slice(0, 3)
        .map(f => `FILE: ${f.name}\n${f.content.substring(0, 500)}`)
        .join('\n\n');

      let promptText = '';
      if (promptType === 'readme') {
        promptText = `Generate a modern, clean, production-ready README.md for this project "${project.title}".
Include: Overview, Tech Stack, Prerequisites, Installation & Run commands, Project Structure, and Contributing guidelines.
Project Description: ${project.description || ''}
Files:
${fileList}
Sample Code:
${sampleCode}`;
      } else if (promptType === 'architecture') {
        promptText = `Generate a detailed ARCHITECTURE.md for "${project.title}".
Explain the data flow, module boundaries, system components, error handling strategy, and extensibility points.
Files:
${fileList}`;
      } else {
        promptText = `Generate an API.md reference documentation for "${project.title}" detailing available functions, endpoints, types, and payloads based on these files:
${fileList}
${sampleCode}`;
      }

      const generated = await api.aiChat(
        activeProvider.provider,
        activeProvider.apiKey || '',
        activeProvider.defaultModel,
        activeProvider.endpoint,
        'You are an expert technical documentation writer. Write clean, well-structured GitHub-flavored Markdown without unnecessary intro text.',
        promptText
      );

      setDocContent(generated);
      addToast(
        isRu ? 'Документация сгенерирована!' : 'Documentation generated!',
        isRu ? 'Не забудьте нажать "Сохранить"' : 'Remember to click Save',
        'success'
      );
    } catch (err: any) {
      addToast(isRu ? 'Ошибка генерации' : 'Generation failed', String(err), 'error');
    } finally {
      setIsGenerating(false);
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
      {/* Left: Document List Sidebar */}
      <div
        style={{
          width: 240,
          backgroundColor: '#111115',
          borderRight: '1px solid #25252D',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <BookOpen size={16} color="#8B6CFF" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F1F1F5' }}>
              {isRu ? 'Документы' : 'Documents'}
            </span>
          </div>

          <button
            onClick={() => setIsCreatingNew(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8B6CFF',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* New doc creation input */}
        {isCreatingNew && (
          <div
            style={{
              padding: 10,
              backgroundColor: '#16161C',
              borderBottom: '1px solid #25252D',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <input
              type="text"
              value={newDocName}
              onChange={e => setNewDocName(e.target.value)}
              placeholder="e.g. ARCHITECTURE.md"
              style={{
                padding: '6px 8px',
                backgroundColor: '#0B0B0E',
                border: '1px solid #25252D',
                borderRadius: 4,
                color: '#F1F1F5',
                fontSize: '0.74rem',
                outline: 'none',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateNewDoc();
                if (e.key === 'Escape') setIsCreatingNew(false);
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button
                onClick={() => setIsCreatingNew(false)}
                style={{
                  padding: '3px 8px',
                  background: 'none',
                  border: '1px solid #25252D',
                  borderRadius: 4,
                  color: '#92929F',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                }}
              >
                {isRu ? 'Отмена' : 'Cancel'}
              </button>
              <button
                onClick={handleCreateNewDoc}
                style={{
                  padding: '3px 10px',
                  background: '#8B6CFF',
                  border: 'none',
                  borderRadius: 4,
                  color: '#0B0B0E',
                  fontWeight: 600,
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                }}
              >
                {isRu ? 'Создать' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* List of files */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {docFiles.length === 0 ? (
            <div
              style={{
                padding: 12,
                textAlign: 'center',
                color: '#686877',
                fontSize: '0.74rem',
              }}
            >
              {isRu ? 'Нет markdown файлов' : 'No markdown files'}
            </div>
          ) : (
            docFiles.map(doc => {
              const isSelected = doc.id === activeDocId;
              return (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDoc(doc.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 5,
                    border: isSelected ? '1px solid rgba(139, 108, 255, 0.4)' : '1px solid transparent',
                    backgroundColor: isSelected ? 'rgba(139, 108, 255, 0.12)' : 'transparent',
                    color: isSelected ? '#F1F1F5' : '#92929F',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FileText size={14} color={isSelected ? '#8B6CFF' : '#686877'} />
                  <span
                    style={{
                      fontSize: '0.76rem',
                      fontWeight: isSelected ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {doc.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Document Editor / Preview */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top Doc Toolbar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#F1F1F5' }}>
              {activeDoc ? activeDoc.name : isRu ? 'Выберите документ' : 'Select a document'}
            </span>

            {/* AI Assistant Generator Dropdown/Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <button
                onClick={() => handleAiGenerateDocs('readme')}
                disabled={isGenerating || !activeDoc}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 9px',
                  backgroundColor: '#16161C',
                  border: '1px solid #25252D',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  color: '#A78BFA',
                  cursor: isGenerating ? 'wait' : 'pointer',
                }}
              >
                {isGenerating ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                README
              </button>
              <button
                onClick={() => handleAiGenerateDocs('architecture')}
                disabled={isGenerating || !activeDoc}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 9px',
                  backgroundColor: '#16161C',
                  border: '1px solid #25252D',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  color: '#A78BFA',
                  cursor: isGenerating ? 'wait' : 'pointer',
                }}
              >
                {isGenerating ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                Архитектура
              </button>
            </div>
          </div>

          {/* View Mode & Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Split / Edit / Preview Toggle */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 5,
                padding: 2,
              }}
            >
              <button
                onClick={() => setViewMode('split')}
                title="Split View"
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: viewMode === 'split' ? 'rgba(139, 108, 255, 0.2)' : 'none',
                  border: 'none',
                  color: viewMode === 'split' ? '#8B6CFF' : '#92929F',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <Columns size={14} />
              </button>
              <button
                onClick={() => setViewMode('edit')}
                title="Editor Only"
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: viewMode === 'edit' ? 'rgba(139, 108, 255, 0.2)' : 'none',
                  border: 'none',
                  color: viewMode === 'edit' ? '#8B6CFF' : '#92929F',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <Edit3 size={14} />
              </button>
              <button
                onClick={() => setViewMode('preview')}
                title="Preview Only"
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: viewMode === 'preview' ? 'rgba(139, 108, 255, 0.2)' : 'none',
                  border: 'none',
                  color: viewMode === 'preview' ? '#8B6CFF' : '#92929F',
                  cursor: 'pointer',
                  display: 'flex',
                }}
              >
                <Eye size={14} />
              </button>
            </div>

            <button
              onClick={handleSaveDoc}
              disabled={!activeDoc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                backgroundColor: '#8B6CFF',
                border: 'none',
                borderRadius: 5,
                color: '#0B0B0E',
                fontWeight: 600,
                fontSize: '0.76rem',
                cursor: activeDoc ? 'pointer' : 'default',
                opacity: activeDoc ? 1 : 0.5,
              }}
            >
              <Save size={14} />
              {isRu ? 'Сохранить' : 'Save'}
            </button>
          </div>
        </div>

        {/* Doc Content Area */}
        {activeDoc ? (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Editor Pane */}
            {(viewMode === 'split' || viewMode === 'edit') && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: viewMode === 'split' ? '1px solid #25252D' : 'none',
                  backgroundColor: '#0B0B0E',
                  overflow: 'hidden',
                }}
              >
                <textarea
                  value={docContent}
                  onChange={e => setDocContent(e.target.value)}
                  placeholder="Markdown content..."
                  style={{
                    flex: 1,
                    width: '100%',
                    height: '100%',
                    padding: 16,
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#F1F1F5',
                    fontSize: '0.82rem',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    lineHeight: 1.6,
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>
            )}

            {/* Preview Pane */}
            {(viewMode === 'split' || viewMode === 'preview') && (
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 20,
                  backgroundColor: '#111115',
                  color: '#F1F1F5',
                  lineHeight: 1.6,
                  fontSize: '0.85rem',
                }}
              >
                {/* Render Markdown blocks */}
                <div style={{ maxWidth: 740, margin: '0 auto' }}>
                  {docContent.split('\n\n').map((block, idx) => {
                    const trimmed = block.trim();
                    if (trimmed.startsWith('# ')) {
                      return (
                        <h1
                          key={idx}
                          style={{
                            fontSize: '1.4rem',
                            fontWeight: 700,
                            color: '#F1F1F5',
                            borderBottom: '1px solid #25252D',
                            paddingBottom: 8,
                            margin: '18px 0 12px',
                          }}
                        >
                          {trimmed.replace('# ', '')}
                        </h1>
                      );
                    }
                    if (trimmed.startsWith('## ')) {
                      return (
                        <h2
                          key={idx}
                          style={{
                            fontSize: '1.15rem',
                            fontWeight: 600,
                            color: '#F1F1F5',
                            margin: '16px 0 10px',
                          }}
                        >
                          {trimmed.replace('## ', '')}
                        </h2>
                      );
                    }
                    if (trimmed.startsWith('### ')) {
                      return (
                        <h3
                          key={idx}
                          style={{
                            fontSize: '0.98rem',
                            fontWeight: 600,
                            color: '#A78BFA',
                            margin: '14px 0 8px',
                          }}
                        >
                          {trimmed.replace('### ', '')}
                        </h3>
                      );
                    }
                    if (trimmed.startsWith('```')) {
                      const codeContent = trimmed.replace(/^```[a-zA-Z0-9_\-]*\n/, '').replace(/\n```$/, '');
                      return (
                        <pre
                          key={idx}
                          style={{
                            backgroundColor: '#16161C',
                            border: '1px solid #25252D',
                            borderRadius: 6,
                            padding: 12,
                            overflowX: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                            color: '#A78BFA',
                            margin: '12px 0',
                          }}
                        >
                          {codeContent}
                        </pre>
                      );
                    }
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                      const items = trimmed.split('\n');
                      return (
                        <ul key={idx} style={{ paddingLeft: 20, margin: '8px 0' }}>
                          {items.map((item, iIdx) => (
                            <li key={iIdx} style={{ color: '#92929F', marginBottom: 4 }}>
                              {item.replace(/^[-*]\s*/, '')}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={idx} style={{ margin: '8px 0', color: '#92929F', whiteSpace: 'pre-wrap' }}>
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#686877',
              fontSize: '0.82rem',
            }}
          >
            {isRu ? 'Выберите документ слева или создайте новый' : 'Select a document or create one'}
          </div>
        )}
      </div>
    </div>
  );
};
