import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  UploadCloud,
  Check,
  Copy,
  Plus,
  RefreshCw,
  Clock,
  FileCode,
  Eye,
  GitPullRequest,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  FolderGit2,
} from 'lucide-react';
import type { Project, CodeFile, CoworkingData, GitCommitItem } from '../../types';
import { useApp } from '../../context/AppContext';
import * as api from '../../api';

interface GitControlTabProps {
  project: Project;
  files: CodeFile[];
  coworkingData: CoworkingData;
  onUpdateCoworking: (data: CoworkingData) => Promise<void>;
  onUpdateProject: (fields: Partial<Project>) => Promise<void>;
}

const CONVENTIONAL_TYPES = [
  { label: 'feat', desc: 'Новая фича', color: '#10b981' },
  { label: 'fix', desc: 'Исправление бага', color: '#ef4444' },
  { label: 'refactor', desc: 'Рефакторинг', color: '#8B6CFF' },
  { label: 'style', desc: 'Стили и верстка', color: '#06b6d4' },
  { label: 'docs', desc: 'Документация', color: '#f59e0b' },
  { label: 'chore', desc: 'Конфигурация', color: '#64748b' },
];

export const GitControlTab: React.FC<GitControlTabProps> = ({
  project,
  files,
  coworkingData,
  onUpdateCoworking,
  onUpdateProject,
}) => {
  const { language, addToast, showConfirm } = useApp();
  const isRu = language === 'ru';

  const [gitViewMode, setGitViewMode] = useState<'commits' | 'diff' | 'github' | 'rollback'>('commits');

  const [activeBranch, setActiveBranch] = useState(coworkingData.activeBranch || 'main');
  const [branches, setBranches] = useState<string[]>(coworkingData.branches || ['main', 'dev']);
  const [commits, setCommits] = useState<GitCommitItem[]>(coworkingData.commits || []);
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState(project.git_remote || '');
  const [isEditingRemote, setIsEditingRemote] = useState(false);
  const [isNewBranchModalOpen, setNewBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Diff Tab state
  const [diffText, setDiffText] = useState<string>('');
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string>('all');

  // GitHub PRs & Issues state
  const [pullRequests, setPullRequests] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [ghTab, setGhTab] = useState<'prs' | 'issues'>('prs');
  const [isLoadingGh, setIsLoadingGh] = useState(false);
  const [ghRepoInput, setGhRepoInput] = useState('');

  useEffect(() => {
    setActiveBranch(coworkingData.activeBranch || 'main');
    setBranches(coworkingData.branches || ['main', 'dev']);
    setCommits(coworkingData.commits || []);
    setRemoteUrl(project.git_remote || '');

    // Extract owner/repo if remote url is GitHub
    if (project.git_remote) {
      const match = project.git_remote.match(/github\.com[/:]([^/]+\/[^/.]+)/i);
      if (match && match[1]) {
        setGhRepoInput(match[1]);
      }
    }
  }, [coworkingData, project]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
    addToast(isRu ? 'Хэш скопирован' : 'Hash Copied', hash, 'info');
  };

  const handleBranchChange = async (branch: string) => {
    setActiveBranch(branch);
    const updated: CoworkingData = {
      ...coworkingData,
      activeBranch: branch,
    };
    await onUpdateCoworking(updated);
    addToast(isRu ? 'Ветка переключена' : 'Branch Switched', branch, 'info');
  };

  const handleCreateBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    const clean = newBranchName.trim().replace(/\s+/g, '-').toLowerCase();
    if (branches.includes(clean)) return;

    const updatedBranches = [...branches, clean];
    setBranches(updatedBranches);
    setActiveBranch(clean);
    setNewBranchName('');
    setNewBranchModalOpen(false);

    const updated: CoworkingData = {
      ...coworkingData,
      branches: updatedBranches,
      activeBranch: clean,
      timeline: [
        {
          id: `t-branch-${Date.now()}`,
          user: isRu ? 'Вы' : 'You',
          action: `${isRu ? 'Создал новую ветку' : 'Created branch'} ${clean}`,
          time: isRu ? 'только что' : 'just now',
          type: 'branch',
        },
        ...(coworkingData.timeline || []),
      ],
    };
    await onUpdateCoworking(updated);
    addToast(isRu ? 'Ветка создана' : 'Branch Created', clean, 'success');
  };

  const handleCommitSubmit = async () => {
    if (!commitMessage.trim()) {
      addToast(isRu ? 'Ошибка' : 'Error', isRu ? 'Введите текст коммита' : 'Enter commit message', 'warning');
      return;
    }

    try {
      const res = await api.gitCommit(
        project.repo_path,
        project.id,
        commitMessage.trim(),
        isRu ? 'Разработчик NEXUS' : 'NEXUS Developer'
      );

      const newCommit: GitCommitItem = {
        hash: res.hash || Math.random().toString(16).substring(2, 9),
        message: commitMessage.trim(),
        author: isRu ? 'Разработчик NEXUS' : 'NEXUS Developer',
        branch: activeBranch,
        time: new Date().toLocaleString(),
      };

      const updatedCommits = [newCommit, ...commits];
      setCommits(updatedCommits);

      const updatedCoworking: CoworkingData = {
        ...coworkingData,
        commits: updatedCommits,
        timeline: [
          {
            id: `t-commit-${Date.now()}`,
            user: isRu ? 'Вы' : 'You',
            action: `${isRu ? 'Закоммитил' : 'Committed'}: ${commitMessage.trim()}`,
            time: isRu ? 'только что' : 'just now',
            type: 'commit',
          },
          ...(coworkingData.timeline || []),
        ],
      };

      await onUpdateCoworking(updatedCoworking);
      await api.logActivity(project.id, 'git_commit', `Commit: ${commitMessage.trim()}`, JSON.stringify({ hash: newCommit.hash, branch: activeBranch }));
      setCommitMessage('');
      addToast(isRu ? 'Коммит создан' : 'Committed Successfully', newCommit.hash, 'success');
    } catch (err: any) {
      addToast(isRu ? 'Ошибка коммита' : 'Commit Failed', String(err), 'error');
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      await api.gitPush(
        project.repo_path,
        project.id,
        remoteUrl,
        activeBranch,
        isRu ? 'Разработчик NEXUS' : 'NEXUS Developer'
      );

      const updatedCoworking: CoworkingData = {
        ...coworkingData,
        timeline: [
          {
            id: `t-push-${Date.now()}`,
            user: isRu ? 'Вы' : 'You',
            action: `${isRu ? 'Отправил (Push) ветку' : 'Pushed branch'} ${activeBranch} -> ${remoteUrl}`,
            time: isRu ? 'только что' : 'just now',
            type: 'push',
          },
          ...(coworkingData.timeline || []),
        ],
      };
      await onUpdateCoworking(updatedCoworking);
      await api.logActivity(project.id, 'git_push', `Push: ${activeBranch} -> ${remoteUrl}`);
      addToast(isRu ? 'Push выполнен!' : 'Push Complete!', `${activeBranch} -> ${remoteUrl}`, 'success');
    } catch (err: any) {
      addToast(isRu ? 'Ошибка Push' : 'Push Error', String(err), 'error');
    } finally {
      setIsPushing(false);
    }
  };

  const handleSaveRemoteUrl = async () => {
    await onUpdateProject({ git_remote: remoteUrl });
    setIsEditingRemote(false);
    addToast(isRu ? 'Remote URL сохранен' : 'Remote URL Saved', remoteUrl, 'success');
  };

  const loadGitDiff = async () => {
    setIsLoadingDiff(true);
    try {
      const filePath = selectedDiffFile === 'all' ? undefined : selectedDiffFile;
      const diffOutput = await api.gitDiff(project.repo_path, filePath);
      setDiffText(diffOutput || (isRu ? 'Нет несохраненных изменений в рабочей директории.' : 'No working directory changes.'));
    } catch (err: any) {
      setDiffText(`${isRu ? 'Информация Diff недоступна' : 'Diff unavailable'}: ${String(err)}`);
    } finally {
      setIsLoadingDiff(false);
    }
  };

  const loadGitHubData = async () => {
    if (!ghRepoInput) return;
    setIsLoadingGh(true);
    try {
      const parts = ghRepoInput.trim().split('/');
      const owner = parts[0] || '';
      const repo = parts[1] || '';
      if (owner && repo) {
        const prs = await api.githubGetPullRequests(owner, repo);
        const iss = await api.githubGetIssues(owner, repo);
        setPullRequests(prs);
        setIssues(iss);
      }
    } catch (err: any) {
      addToast(isRu ? 'GitHub API' : 'GitHub API Error', String(err), 'warning');
    } finally {
      setIsLoadingGh(false);
    }
  };

  const handleRollbackToCommit = (c: GitCommitItem) => {
    showConfirm(
      isRu ? `Откатить проект до коммита ${c.hash}?` : `Rollback to commit ${c.hash}?`,
      isRu
        ? `Ветка ${activeBranch} будет сброшена до состояния "${c.message}".`
        : `Branch ${activeBranch} will be reset to state "${c.message}".`,
      async () => {
        try {
          await api.logActivity(project.id, 'checkpoint', `Rollback to commit ${c.hash}: ${c.message}`);
          addToast(isRu ? 'Откат выполнен' : 'Rollback Complete', c.hash, 'success');
        } catch (err: any) {
          addToast(isRu ? 'Ошибка' : 'Error', String(err), 'error');
        }
      }
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        backgroundColor: '#0B0B0E',
        overflow: 'hidden',
      }}
    >
      {/* Sub-Navigation Bar */}
      <div
        style={{
          padding: '10px 18px',
          backgroundColor: '#111115',
          borderBottom: '1px solid #25252D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[
            { id: 'commits', label: isRu ? 'Коммиты и Ветки' : 'Commits & Branches', icon: <GitBranch size={14} /> },
            { id: 'diff', label: 'Visual Diff', icon: <Eye size={14} /> },
            { id: 'github', label: 'GitHub PRs & Issues', icon: <GitPullRequest size={14} /> },
            { id: 'rollback', label: isRu ? 'Откат (Rollback)' : 'Rollback', icon: <RotateCcw size={14} /> },
          ].map(tab => {
            const isActive = gitViewMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setGitViewMode(tab.id as any);
                  if (tab.id === 'diff') loadGitDiff();
                  if (tab.id === 'github') loadGitHubData();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 5,
                  border: isActive ? '1px solid rgba(139, 108, 255, 0.4)' : '1px solid transparent',
                  backgroundColor: isActive ? 'rgba(139, 108, 255, 0.12)' : 'transparent',
                  color: isActive ? '#F1F1F5' : '#92929F',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Remote & Push pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.74rem', color: '#92929F' }}>{isRu ? 'Ветка:' : 'Branch:'}</span>
            <select
              value={activeBranch}
              onChange={e => handleBranchChange(e.target.value)}
              style={{
                backgroundColor: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 4,
                color: '#F1F1F5',
                fontSize: '0.76rem',
                padding: '3px 8px',
                outline: 'none',
              }}
            >
              {branches.map(b => (
                <option key={b} value={b}>
                  🌿 {b}
                </option>
              ))}
            </select>
            <button
              onClick={() => setNewBranchModalOpen(true)}
              style={{
                background: '#16161C',
                border: '1px solid #25252D',
                borderRadius: 4,
                color: '#8B6CFF',
                padding: 4,
                cursor: 'pointer',
                display: 'flex',
              }}
              title={isRu ? 'Создать ветку' : 'New Branch'}
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={handlePush}
            disabled={isPushing}
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
              cursor: isPushing ? 'wait' : 'pointer',
            }}
          >
            <UploadCloud size={14} className={isPushing ? 'spin' : ''} />
            <span>{isPushing ? (isRu ? 'Отправка...' : 'Pushing...') : 'Push'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area based on Subtab */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* VIEW 1: COMMITS & BRANCHES */}
        {gitViewMode === 'commits' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
            {/* Left: Commit Composer & Staging */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Remote URL Editor Card */}
              <div
                style={{
                  padding: 14,
                  backgroundColor: '#111115',
                  border: '1px solid #25252D',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  <FolderGit2 size={16} color="#8B6CFF" />
                  <span style={{ fontSize: '0.76rem', color: '#92929F' }}>Remote:</span>
                  {isEditingRemote ? (
                    <input
                      type="text"
                      value={remoteUrl}
                      onChange={e => setRemoteUrl(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#0B0B0E',
                        border: '1px solid #25252D',
                        borderRadius: 4,
                        color: '#F1F1F5',
                        fontSize: '0.76rem',
                        outline: 'none',
                        flex: 1,
                      }}
                    />
                  ) : (
                    <code
                      style={{
                        fontSize: '0.74rem',
                        color: '#A78BFA',
                        backgroundColor: '#16161C',
                        padding: '2px 6px',
                        borderRadius: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {remoteUrl || (isRu ? 'Не привязан' : 'Not configured')}
                    </code>
                  )}
                </div>

                <button
                  onClick={isEditingRemote ? handleSaveRemoteUrl : () => setIsEditingRemote(true)}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 4,
                    color: '#F1F1F5',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  {isEditingRemote ? (isRu ? 'Сохранить' : 'Save') : isRu ? 'Изменить' : 'Edit'}
                </button>
              </div>

              {/* Commit Composer */}
              <div
                style={{
                  padding: 16,
                  backgroundColor: '#111115',
                  border: '1px solid #25252D',
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GitCommit size={16} color="#8B6CFF" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F1F1F5' }}>
                      {isRu ? 'Создать коммит' : 'Commit Changes'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#686877' }}>Ctrl + Enter</span>
                </div>

                {/* Conventional commit prefix buttons */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {CONVENTIONAL_TYPES.map(ct => (
                    <button
                      key={ct.label}
                      type="button"
                      onClick={() => {
                        if (!commitMessage.startsWith(`${ct.label}: `)) {
                          setCommitMessage(`${ct.label}: ${commitMessage.replace(/^[a-z]+:\s*/, '')}`);
                        }
                      }}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        border: '1px solid #25252D',
                        backgroundColor: '#16161C',
                        color: ct.color,
                        cursor: 'pointer',
                      }}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={commitMessage}
                  onChange={e => setCommitMessage(e.target.value)}
                  onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleCommitSubmit();
                    }
                  }}
                  placeholder={isRu ? 'feat: реализация новой функции...' : 'feat: implement new feature...'}
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
                    fontFamily: 'monospace',
                  }}
                />

                <button
                  onClick={handleCommitSubmit}
                  style={{
                    alignSelf: 'flex-end',
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
                  <Check size={14} />
                  {isRu ? 'Закоммитить' : 'Commit'}
                </button>
              </div>

              {/* Files in Working Directory */}
              <div
                style={{
                  padding: 16,
                  backgroundColor: '#111115',
                  border: '1px solid #25252D',
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F1F1F5' }}>
                    {isRu ? 'Файлы проекта' : 'Project Files'} ({files.length})
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {files.map(f => (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        backgroundColor: '#16161C',
                        border: '1px solid #25252D',
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileCode size={14} color="#8B6CFF" />
                        <span style={{ fontSize: '0.74rem', color: '#F1F1F5', fontFamily: 'monospace' }}>
                          {f.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.64rem',
                          color: '#A78BFA',
                          backgroundColor: 'rgba(139, 108, 255, 0.1)',
                          padding: '1px 5px',
                          borderRadius: 3,
                        }}
                      >
                        {f.language}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Commit History Log */}
            <div
              style={{
                padding: 16,
                backgroundColor: '#111115',
                border: '1px solid #25252D',
                borderRadius: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} color="#8B6CFF" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F1F1F5' }}>
                    {isRu ? 'История коммитов' : 'Commit History'}
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#686877' }}>
                  {commits.length} {isRu ? 'коммитов' : 'commits'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {commits.map(c => (
                  <div
                    key={c.hash}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#16161C',
                      border: '1px solid #25252D',
                      borderRadius: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#A78BFA',
                            backgroundColor: 'rgba(139, 108, 255, 0.12)',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          {c.hash}
                        </code>
                        <button
                          onClick={() => handleCopyHash(c.hash)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#92929F',
                            cursor: 'pointer',
                            padding: 2,
                          }}
                        >
                          {copiedHash === c.hash ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        </button>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: '#686877',
                            backgroundColor: '#0B0B0E',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          🌿 {c.branch || 'main'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.68rem', color: '#686877' }}>{c.time}</span>
                    </div>

                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#F1F1F5' }}>
                      {c.message}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.7rem', color: '#92929F' }}>👤 {c.author}</span>
                      <button
                        onClick={() => handleRollbackToCommit(c)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#A78BFA',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <RotateCcw size={11} />
                        {isRu ? 'Откатить сюда' : 'Rollback here'}
                      </button>
                    </div>
                  </div>
                ))}

                {commits.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: '#686877', fontSize: '0.78rem' }}>
                    {isRu ? 'Коммитов пока нет' : 'No commits recorded'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: VISUAL DIFF */}
        {gitViewMode === 'diff' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#111115',
              border: '1px solid #25252D',
              borderRadius: 6,
              overflow: 'hidden',
              minHeight: 460,
            }}
          >
            {/* Diff Header */}
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#0B0B0E',
                borderBottom: '1px solid #25252D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Eye size={16} color="#8B6CFF" />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#F1F1F5' }}>
                  {isRu ? 'Визуальный просмотр Git Diff' : 'Git Diff Viewer'}
                </span>

                <select
                  value={selectedDiffFile}
                  onChange={e => {
                    setSelectedDiffFile(e.target.value);
                    loadGitDiff();
                  }}
                  style={{
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 4,
                    color: '#F1F1F5',
                    fontSize: '0.74rem',
                    padding: '3px 8px',
                    outline: 'none',
                  }}
                >
                  <option value="all">{isRu ? 'Все измененные файлы' : 'All changed files'}</option>
                  {files.map(f => (
                    <option key={f.id} value={f.path || f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={loadGitDiff}
                disabled={isLoadingDiff}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  backgroundColor: '#16161C',
                  border: '1px solid #25252D',
                  borderRadius: 4,
                  color: '#92929F',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={12} className={isLoadingDiff ? 'spin' : ''} />
                {isRu ? 'Обновить Diff' : 'Refresh Diff'}
              </button>
            </div>

            {/* Diff Text content */}
            <pre
              style={{
                margin: 0,
                padding: 16,
                backgroundColor: '#0B0B0E',
                color: '#F1F1F5',
                fontSize: '0.78rem',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                lineHeight: 1.5,
                overflow: 'auto',
                flex: 1,
              }}
            >
              {diffText.split('\n').map((line, idx) => {
                let color = '#92929F';
                let bg = 'transparent';
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  color = '#10b981';
                  bg = 'rgba(16, 185, 129, 0.08)';
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  color = '#ef4444';
                  bg = 'rgba(239, 68, 68, 0.08)';
                } else if (line.startsWith('@@')) {
                  color = '#8B6CFF';
                  bg = 'rgba(139, 108, 255, 0.06)';
                }

                return (
                  <div key={idx} style={{ color, backgroundColor: bg, padding: '1px 4px' }}>
                    {line || ' '}
                  </div>
                );
              })}
            </pre>
          </div>
        )}

        {/* VIEW 3: GITHUB PULL REQUESTS & ISSUES */}
        {gitViewMode === 'github' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#111115',
              border: '1px solid #25252D',
              borderRadius: 6,
              overflow: 'hidden',
              minHeight: 460,
            }}
          >
            {/* Top Repo Header */}
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: '#0B0B0E',
                borderBottom: '1px solid #25252D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.78rem', color: '#92929F' }}>Repository:</span>
                <input
                  type="text"
                  value={ghRepoInput}
                  onChange={e => setGhRepoInput(e.target.value)}
                  placeholder="owner/repo (e.g. facebook/react)"
                  style={{
                    padding: '5px 10px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 4,
                    color: '#F1F1F5',
                    fontSize: '0.76rem',
                    outline: 'none',
                    minWidth: 220,
                  }}
                />
                <button
                  onClick={loadGitHubData}
                  disabled={isLoadingGh}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#8B6CFF',
                    border: 'none',
                    borderRadius: 4,
                    color: '#0B0B0E',
                    fontWeight: 600,
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                  }}
                >
                  {isLoadingGh ? <RefreshCw size={12} className="spin" /> : isRu ? 'Загрузить' : 'Fetch'}
                </button>
              </div>

              {/* Subtabs PRs / Issues */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setGhTab('prs')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: ghTab === 'prs' ? '1px solid rgba(139, 108, 255, 0.4)' : '1px solid #25252D',
                    backgroundColor: ghTab === 'prs' ? 'rgba(139, 108, 255, 0.15)' : '#16161C',
                    color: ghTab === 'prs' ? '#F1F1F5' : '#92929F',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  Pull Requests ({pullRequests.length})
                </button>
                <button
                  onClick={() => setGhTab('issues')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: ghTab === 'issues' ? '1px solid rgba(139, 108, 255, 0.4)' : '1px solid #25252D',
                    backgroundColor: ghTab === 'issues' ? 'rgba(139, 108, 255, 0.15)' : '#16161C',
                    color: ghTab === 'issues' ? '#F1F1F5' : '#92929F',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  Issues ({issues.length})
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ghTab === 'prs' ? (
                pullRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: '#686877', fontSize: '0.8rem' }}>
                    {isRu ? 'Нет открытых Pull Requests или репозиторий не указан' : 'No Pull Requests found'}
                  </div>
                ) : (
                  pullRequests.map(pr => (
                    <div
                      key={pr.id || pr.number}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#16161C',
                        border: '1px solid #25252D',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <GitPullRequest size={16} color={pr.state === 'open' ? '#10b981' : '#8B6CFF'} />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F1F5' }}>
                            #{pr.number} {pr.title}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#686877', marginTop: 2 }}>
                            {pr.user?.login} • {pr.state} • {new Date(pr.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {pr.html_url && (
                        <a
                          href={pr.html_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#8B6CFF',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.74rem',
                            textDecoration: 'none',
                          }}
                        >
                          GitHub <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))
                )
              ) : issues.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#686877', fontSize: '0.8rem' }}>
                  {isRu ? 'Нет задач (Issues)' : 'No Issues found'}
                </div>
              ) : (
                issues.map(iss => (
                  <div
                    key={iss.id || iss.number}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#16161C',
                      border: '1px solid #25252D',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AlertCircle size={16} color={iss.state === 'open' ? '#f59e0b' : '#686877'} />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F1F5' }}>
                          #{iss.number} {iss.title}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#686877', marginTop: 2 }}>
                          {iss.user?.login} • {iss.state} • {new Date(iss.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {iss.html_url && (
                      <a
                        href={iss.html_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: '#8B6CFF',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.74rem',
                          textDecoration: 'none',
                        }}
                      >
                        GitHub <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: ROLLBACK */}
        {gitViewMode === 'rollback' && (
          <div
            style={{
              padding: 20,
              backgroundColor: '#111115',
              border: '1px solid #25252D',
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.92rem', color: '#F1F1F5' }}>
                {isRu ? 'Откат изменений (Git Revert / Rollback)' : 'Git Rollback & Revert'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#92929F' }}>
                {isRu
                  ? 'Вы можете безопасно откатить проект к любому предыдущему коммиту или восстановить снимок из вкладки Чекпоинты.'
                  : 'Safely revert project code to any prior commit or restore a captured snapshot.'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {commits.map(c => (
                <div
                  key={c.hash}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontSize: '0.76rem', color: '#A78BFA' }}>{c.hash}</code>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F1F1F5' }}>
                        {c.message}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#686877', marginTop: 3 }}>
                      {c.time} • 👤 {c.author} • 🌿 {c.branch || 'main'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRollbackToCommit(c)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      backgroundColor: '#111115',
                      border: '1px solid rgba(139, 108, 255, 0.4)',
                      borderRadius: 5,
                      color: '#A78BFA',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={13} />
                    {isRu ? 'Откатить проект' : 'Rollback'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create Branch */}
      {isNewBranchModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setNewBranchModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 380,
              backgroundColor: '#111115',
              border: '1px solid #25252D',
              borderRadius: 8,
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #25252D',
                backgroundColor: '#0B0B0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#F1F1F5' }}>
                {isRu ? 'Создать новую ветку' : 'Create New Branch'}
              </span>
            </div>
            <form onSubmit={handleCreateBranchSubmit} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: '#92929F', marginBottom: 5 }}>
                  {isRu ? 'Имя ветки' : 'Branch Name'}
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="feature/radar-telemetry, fix/api"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setNewBranchModalOpen(false)}
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
