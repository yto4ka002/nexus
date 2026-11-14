import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RotateCcw,
  Plus,
  Clock,
  FolderArchive,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import * as api from '../../api';
import type { Project, CodeFile } from '../../types';
import { useApp } from '../../context/AppContext';

interface ProjectCheckpointsTabProps {
  project: Project;
  files: CodeFile[];
  onUpdateFiles: (files: CodeFile[]) => Promise<void>;
  isRu: boolean;
}

export const ProjectCheckpointsTab: React.FC<ProjectCheckpointsTabProps> = ({
  project,
  files,
  onUpdateFiles,
  isRu,
}) => {
  const { addToast, showConfirm } = useApp();
  const [checkpoints, setCheckpoints] = useState<api.CheckpointRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [checkpointName, setCheckpointName] = useState('');
  const [checkpointDesc, setCheckpointDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadCheckpoints();
  }, [project.id]);

  const loadCheckpoints = async () => {
    setIsLoading(true);
    try {
      const list = await api.listCheckpoints(project.id);
      setCheckpoints(list);
    } catch {
      setCheckpoints([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkpointName.trim()) return;

    setIsCreating(true);
    try {
      const record = await api.createCheckpoint(
        project.id,
        checkpointName.trim(),
        checkpointDesc.trim() || undefined,
        JSON.stringify(files)
      );

      await api.logActivity(
        project.id,
        'checkpoint',
        `Created snapshot: ${record.name}`,
        JSON.stringify({ filesCount: files.length })
      );

      setCheckpoints(prev => [record, ...prev]);
      setCheckpointName('');
      setCheckpointDesc('');
      setCreateModalOpen(false);
      addToast(
        isRu ? 'Чекпоинт сохранен!' : 'Checkpoint Created!',
        record.name,
        'success'
      );
    } catch (err: any) {
      addToast(isRu ? 'Ошибка' : 'Error', String(err), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = (cp: api.CheckpointRecord) => {
    showConfirm(
      isRu ? `Восстановить проект до "${cp.name}"?` : `Restore project to "${cp.name}"?`,
      isRu
        ? 'Текущие несохраненные файлы будут перезаписаны состоянием этого чекпоинта.'
        : 'Current project files will be reverted to the snapshot captured in this checkpoint.',
      async () => {
        try {
          const restoredFilesJson = await api.restoreCheckpoint(cp.id);
          const parsed: CodeFile[] = JSON.parse(restoredFilesJson);
          await onUpdateFiles(parsed);

          await api.logActivity(
            project.id,
            'checkpoint',
            `Restored snapshot: ${cp.name}`,
            JSON.stringify({ checkpointId: cp.id })
          );

          addToast(
            isRu ? 'Проект успешно восстановлен!' : 'Project restored!',
            `${cp.name} (${parsed.length} ${isRu ? 'файлов' : 'files'})`,
            'success'
          );
        } catch (err: any) {
          addToast(isRu ? 'Ошибка отката' : 'Restore error', String(err), 'error');
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
      {/* Top Bar */}
      <div
        style={{
          padding: '12px 18px',
          backgroundColor: '#111115',
          borderBottom: '1px solid #25252D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: 'rgba(139, 108, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8B6CFF',
              border: '1px solid rgba(139, 108, 255, 0.25)',
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#F1F1F5' }}>
              {isRu ? 'Чекпоинты и Снимки Проекта' : 'Project Checkpoints & Snapshots'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#92929F' }}>
              {isRu
                ? 'Быстрые снимки исходных кодов для мгновенного отката до или после крупных правок AI'
                : 'Instant state snapshots allowing safe 1-click rollback before or after major AI changes'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={loadCheckpoints}
            style={{
              padding: '6px 10px',
              backgroundColor: '#16161C',
              border: '1px solid #25252D',
              borderRadius: 5,
              color: '#92929F',
              fontSize: '0.74rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            {isRu ? 'Обновить' : 'Refresh'}
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
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
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            {isRu ? 'Создать снимок' : 'Create Snapshot'}
          </button>
        </div>
      </div>

      {/* Checkpoints list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {checkpoints.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              maxWidth: 400,
              color: '#686877',
            }}
          >
            <FolderArchive size={40} color="#8B6CFF" style={{ opacity: 0.6, margin: '0 auto 12px' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#F1F1F5', marginBottom: 4 }}>
              {isRu ? 'Чекпоинтов пока нет' : 'No snapshots yet'}
            </div>
            <div style={{ fontSize: '0.76rem', lineHeight: 1.5 }}>
              {isRu
                ? 'Создайте первый снимок вручную или воспользуйтесь AI Агентом — перед каждым изменением чекпоинт создается автоматически.'
                : 'Create a snapshot manually or use the AI Agent — snapshots are automatically captured before applying code changes.'}
            </div>
          </div>
        ) : (
          checkpoints.map(cp => {
            const sizeLabel = cp.bytes ? `${Math.round(cp.bytes / 1024)} KB` : (isRu ? 'Снимок' : 'Snapshot');

            return (
              <div
                key={cp.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  backgroundColor: '#111115',
                  border: '1px solid #25252D',
                  borderRadius: 6,
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      backgroundColor: '#16161C',
                      border: '1px solid #25252D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#8B6CFF',
                    }}
                  >
                    <FolderArchive size={18} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F1F1F5' }}>
                        {cp.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: 3,
                          backgroundColor: 'rgba(139, 108, 255, 0.12)',
                          color: '#A78BFA',
                          border: '1px solid rgba(139, 108, 255, 0.25)',
                        }}
                      >
                        {sizeLabel}
                      </span>
                    </div>

                    {cp.description && (
                      <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: '#92929F' }}>
                        {cp.description}
                      </p>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4,
                        fontSize: '0.68rem',
                        color: '#686877',
                      }}
                    >
                      <Clock size={12} />
                      <span>{new Date(cp.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRestore(cp)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    backgroundColor: '#16161C',
                    border: '1px solid rgba(139, 108, 255, 0.3)',
                    borderRadius: 5,
                    color: '#A78BFA',
                    fontSize: '0.76rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <RotateCcw size={14} />
                  {isRu ? 'Откатить проект' : 'Restore'}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
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
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
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
              <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#F1F1F5' }}>
                {isRu ? 'Новый чекпоинт проекта' : 'New Project Snapshot'}
              </h3>
            </div>

            <form onSubmit={handleCreateCheckpoint} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: '#92929F', marginBottom: 5 }}>
                  {isRu ? 'Название снимка' : 'Snapshot Name'} *
                </label>
                <input
                  type="text"
                  required
                  value={checkpointName}
                  onChange={e => setCheckpointName(e.target.value)}
                  placeholder={isRu ? 'например: Перед обновлением API роутов' : 'e.g. Before API refactoring'}
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

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: '#92929F', marginBottom: 5 }}>
                  {isRu ? 'Описание (необязательно)' : 'Description (optional)'}
                </label>
                <textarea
                  rows={3}
                  value={checkpointDesc}
                  onChange={e => setCheckpointDesc(e.target.value)}
                  placeholder={isRu ? 'Кратко опишите состояние...' : 'Describe snapshot state...'}
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
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    padding: '7px 14px',
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
                  disabled={isCreating}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 18px',
                    backgroundColor: '#8B6CFF',
                    border: 'none',
                    borderRadius: 5,
                    color: '#0B0B0E',
                    fontWeight: 600,
                    fontSize: '0.76rem',
                    cursor: isCreating ? 'wait' : 'pointer',
                  }}
                >
                  {isCreating ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                  {isCreating ? (isRu ? 'Сохранение...' : 'Saving...') : isRu ? 'Сохранить снимок' : 'Save Snapshot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
