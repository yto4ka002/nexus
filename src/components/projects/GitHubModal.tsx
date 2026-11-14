import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ExternalLink,
  LogOut,
  RefreshCw,
  Search,
  Lock,
  Globe,
  Star,
  DownloadCloud,
  Check,
  AlertCircle,
  FolderDown,
} from 'lucide-react';
import { GithubIcon } from '../GithubIcon';
import * as api from '../../api';
import { useApp } from '../../context/AppContext';
import type { Project } from '../../types';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectImported: (project: Project) => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({
  isOpen,
  onClose,
  onProjectImported,
}) => {
  const { language, addToast } = useApp();
  const isRu = language === 'ru';

  const [tokenInput, setTokenInput] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [repos, setRepos] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [importingRepoId, setImportingRepoId] = useState<string | null>(null);
  const [importProgressText, setImportProgressText] = useState('');

  // Direct manual import
  const [directRepoInput, setDirectRepoInput] = useState('');
  const [directBranchInput, setDirectBranchInput] = useState('main');
  const [isDirectImporting, setIsDirectImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSession();
    }
  }, [isOpen]);

  const loadSession = async () => {
    try {
      const user = await api.githubGetUser();
      setCurrentUser(user);
      if (user) {
        loadUserRepos();
      }
    } catch {
      setCurrentUser(null);
    }
  };

  const loadUserRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const list = await api.githubListRepos();
      setRepos(list);
    } catch (err: any) {
      addToast(isRu ? 'Ошибка списка репозиториев' : 'Failed to fetch repos', String(err), 'error');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const user = await api.githubLogin(tokenInput.trim());
      setCurrentUser(user);
      setTokenInput('');
      addToast(isRu ? 'Вход выполнен' : 'Logged in', `@${user.login}`, 'success');
      loadUserRepos();
    } catch (err: any) {
      setLoginError(String(err));
      addToast(isRu ? 'Ошибка авторизации' : 'Auth Failed', String(err), 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await api.githubLogout();
    setCurrentUser(null);
    setRepos([]);
    addToast(isRu ? 'Вы вышли из GitHub' : 'Logged out', '', 'info');
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      if (currentUser) loadUserRepos();
      return;
    }

    setIsLoadingRepos(true);
    try {
      const list = await api.githubSearchRepos(searchQuery.trim());
      setRepos(list);
    } catch (err: any) {
      addToast(isRu ? 'Поиск не удался' : 'Search failed', String(err), 'error');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleDirectImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = directRepoInput.trim();
    if (!raw) return;

    let clean = raw.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').trim();
    let owner = '';
    let name = '';

    if (clean.includes('/')) {
      const parts = clean.split('/');
      owner = parts[0].trim();
      name = parts[1].trim();
    } else if (currentUser && currentUser.login) {
      owner = currentUser.login;
      name = clean;
    } else {
      addToast(
        isRu ? 'Укажите владельца' : 'Specify owner',
        isRu ? 'Введите в формате owner/repo (например: yto4ka002/KusairaWeb)' : 'Use format owner/repo',
        'warning'
      );
      return;
    }

    setIsDirectImporting(true);
    setImportProgressText(isRu ? 'Прямой импорт репозитория...' : 'Importing repository...');

    try {
      const project = await api.githubImportRepo(owner, name, directBranchInput.trim() || 'main');
      addToast(isRu ? 'Репозиторий импортирован' : 'Imported', `${owner}/${name}`, 'success');
      onProjectImported(project);
      onClose();
    } catch (err: any) {
      addToast(
        isRu ? 'Ошибка прямого импорта' : 'Import Error',
        String(err),
        'error'
      );
    } finally {
      setIsDirectImporting(false);
      setImportProgressText('');
    }
  };

  const handleImport = async (repo: any) => {
    const owner = repo.owner?.login || repo.full_name?.split('/')[0];
    const name = repo.name || repo.full_name?.split('/')[1];
    const branch = repo.default_branch || 'main';

    if (!owner || !name) return;

    setImportingRepoId(repo.id || `${owner}/${name}`);
    setImportProgressText(isRu ? 'Подключение к GitHub...' : 'Connecting to GitHub...');

    try {
      setImportProgressText(isRu ? 'Загрузка дерева файлов и кода...' : 'Fetching tree & code files...');
      const project = await api.githubImportRepo(owner, name, branch);
      setImportProgressText(isRu ? 'Импорт завершен!' : 'Import finished!');
      addToast(isRu ? 'Репозиторий импортирован' : 'Repository Imported', `${owner}/${name}`, 'success');
      onProjectImported(project);
      onClose();
    } catch (err: any) {
      addToast(isRu ? 'Ошибка импорта' : 'Import Error', String(err), 'error');
    } finally {
      setImportingRepoId(null);
      setImportProgressText('');
    }
  };

  if (!isOpen) return null;

  const filteredRepos = repos.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.language?.toLowerCase().includes(q) ||
      r.full_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 750,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0a0914',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          boxShadow: '0 0 50px rgba(139, 92, 246, 0.2)',
          borderRadius: 12,
        }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(139, 92, 246, 0.2)', padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GithubIcon size={20} color="#c084fc" />
            <span className="modal-title" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
              {isRu ? 'GitHub Интеграция & Импорт' : 'GitHub Integration & Import'}
            </span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
          {/* Section 1: GitHub Account State */}
          {currentUser ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                borderRadius: 9,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src={currentUser.avatar_url || 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'}
                  alt="avatar"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: '2px solid #8b5cf6',
                  }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.94rem', color: '#fff' }}>
                      {currentUser.name || currentUser.login}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#c084fc' }}>@{currentUser.login}</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 1 }}>
                    {isRu ? 'GitHub аккаунт активен' : 'GitHub active'} &bull;{' '}
                    <span style={{ color: '#10b981' }}>{repos.length} {isRu ? 'найдено в API' : 'in list'}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={loadUserRepos}
                  disabled={isLoadingRepos}
                  title={isRu ? 'Обновить список' : 'Refresh repos'}
                >
                  <RefreshCw size={13} className={isLoadingRepos ? 'spin-slow' : ''} />
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => api.launchTarget(currentUser.html_url || 'https://github.com')}
                >
                  <ExternalLink size={13} /> GitHub
                </button>
                <button className="btn btn-danger btn-sm" onClick={handleLogout}>
                  <LogOut size={13} /> {isRu ? 'Выйти' : 'Logout'}
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '16px 18px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 9,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                    {isRu ? 'Вход через GitHub Personal Access Token' : 'Connect GitHub Account'}
                  </span>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>
                    {isRu
                      ? 'Для доступа ко всем приватным репозиториям и форкам рекомендуется создать Personal Access Token (classic) с правами repo.'
                      : 'Create a Personal Access Token (classic) with repo scope for seamless private access.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ whiteSpace: 'nowrap', fontSize: '0.74rem', gap: 5 }}
                  onClick={() =>
                    api.launchTarget(
                      'https://github.com/settings/tokens/new?scopes=repo,read:user&description=NEXUS%20Desktop'
                    )
                  }
                >
                  <Key size={12} color="#f59e0b" /> {isRu ? 'Создать Classic токен' : 'Generate Token'}
                </button>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  className="form-input"
                  style={{ flex: 1, height: 36, fontSize: '0.82rem', fontFamily: 'monospace' }}
                  placeholder="ghp_... или github_pat_..."
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: 36, padding: '0 16px', fontSize: '0.82rem' }}
                  disabled={isLoggingIn || !tokenInput.trim()}
                >
                  {isLoggingIn ? (
                    <RefreshCw size={13} className="spin-slow" />
                  ) : (
                    <Check size={13} />
                  )}
                  {isLoggingIn ? (isRu ? 'Проверка...' : 'Checking...') : (isRu ? 'Войти' : 'Sign In')}
                </button>
              </form>

              {loginError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: '0.76rem' }}>
                  <AlertCircle size={13} />
                  <span>{loginError}</span>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Direct Import by URL or Name (Fix for private forks & quick import!) */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#0e0d1a',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: 9,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <FolderDown size={15} color="#c084fc" />
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#fff' }}>
                {isRu ? 'Прямой импорт репозитория по имени или ссылке' : 'Direct Import by Name / URL'}
              </span>
            </div>

            <form onSubmit={handleDirectImport} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: 2, minWidth: 200, height: 36, fontSize: '0.82rem' }}
                placeholder={
                  currentUser
                    ? `${currentUser.login}/KusairaWeb или просто KusairaWeb`
                    : 'owner/repo или https://github.com/owner/repo'
                }
                value={directRepoInput}
                onChange={e => setDirectRepoInput(e.target.value)}
              />

              <input
                type="text"
                className="form-input"
                style={{ width: 90, height: 36, fontSize: '0.82rem' }}
                placeholder="main"
                value={directBranchInput}
                onChange={e => setDirectBranchInput(e.target.value)}
                title={isRu ? 'Ветка' : 'Branch'}
              />

              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: 36, padding: '0 16px', fontSize: '0.82rem', gap: 6 }}
                disabled={isDirectImporting || !directRepoInput.trim()}
              >
                {isDirectImporting ? <RefreshCw size={13} className="spin-slow" /> : <DownloadCloud size={14} />}
                <span>{isDirectImporting ? (isRu ? 'Загрузка...' : 'Loading...') : (isRu ? 'Импортировать' : 'Import')}</span>
              </button>
            </form>
          </div>

          {/* Section 3: Repository Search & List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 7,
                    padding: '0 10px',
                    gap: 8,
                  }}
                >
                  <Search size={14} color="var(--text-dim)" />
                  <input
                    type="text"
                    placeholder={
                      currentUser
                        ? (isRu ? 'Поиск в ваших репозиториях...' : 'Filter repos...')
                        : (isRu ? 'Введите имя публичного репозитория...' : 'Search public repos...')
                    }
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      flex: 1,
                      height: 36,
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.82rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <button type="submit" className="btn btn-secondary" style={{ height: 36, padding: '0 14px', fontSize: '0.82rem' }}>
                  {isRu ? 'Найти' : 'Search'}
                </button>
              </form>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {currentUser
                  ? (isRu ? 'Доступные репозитории' : 'Available Repositories')
                  : (isRu ? 'Результаты поиска' : 'Search Results')}{' '}
                ({filteredRepos.length})
              </span>
              {importProgressText && (
                <span style={{ fontSize: '0.76rem', color: '#c084fc', fontWeight: 600 }}>
                  ● {importProgressText}
                </span>
              )}
            </div>

            {/* List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxHeight: 280,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {filteredRepos.map(repo => {
                const isImporting = importingRepoId === (repo.id || repo.full_name);
                return (
                  <div
                    key={repo.id || repo.full_name}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                      e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.06)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {repo.private ? (
                          <Lock size={12} color="#f59e0b" />
                        ) : (
                          <Globe size={12} color="#38bdf8" />
                        )}
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                          {repo.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                          {repo.full_name}
                        </span>
                        {repo.default_branch && (
                          <span
                            style={{
                              fontSize: '0.66rem',
                              color: 'var(--text-dim)',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            🌿 {repo.default_branch}
                          </span>
                        )}
                      </div>

                      {repo.description && (
                        <p
                          style={{
                            fontSize: '0.76rem',
                            color: 'var(--text-muted)',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {repo.description}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        {repo.language && (
                          <span style={{ color: '#a78bfa', fontWeight: 600 }}>● {repo.language}</span>
                        )}
                        {repo.stargazers_count !== undefined && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Star size={10} color="#f59e0b" /> {repo.stargazers_count}
                          </span>
                        )}
                        {repo.fork && (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>[Fork]</span>
                        )}
                      </div>
                    </div>

                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isImporting || !!importingRepoId}
                      onClick={() => handleImport(repo)}
                      style={{
                        padding: '6px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        fontSize: '0.76rem',
                      }}
                    >
                      {isImporting ? (
                        <RefreshCw size={12} className="spin-slow" />
                      ) : (
                        <DownloadCloud size={12} />
                      )}
                      <span>
                        {isImporting
                          ? (isRu ? 'Импорт...' : 'Importing...')
                          : (isRu ? 'Загрузить' : 'Import')}
                      </span>
                    </button>
                  </div>
                );
              })}

              {isLoadingRepos && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>
                  <RefreshCw size={18} className="spin-slow" style={{ margin: '0 auto 6px auto' }} />
                  <div style={{ fontSize: '0.8rem' }}>{isRu ? 'Загрузка репозиториев...' : 'Loading repositories...'}</div>
                </div>
              )}

              {!isLoadingRepos && filteredRepos.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px 16px',
                    color: 'var(--text-dim)',
                    border: '1px dashed rgba(255, 255, 255, 0.08)',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                  }}
                >
                  <p>
                    {isRu
                      ? 'В списке пока нет репозиториев. Если репозиторий приватный или форк, введите его имя выше в поле «Прямой импорт» (например: KusairaWeb).'
                      : 'No repositories in list. If your repo is a private fork, use Direct Import above.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid rgba(139, 92, 246, 0.2)', padding: '12px 20px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            {isRu ? 'Закрыть' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
