import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  LayoutDashboard,
  Plus,
  Settings,
  ChevronDown,
  Minus,
  Square,
  X,
  Bot,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import * as api from '../api';
import type { Project } from '../types';

export const Header: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    selectedProjectId,
    setSelectedProjectId,
    language,
    setLanguage,
    showConfirm,
    addToast,
  } = useApp();

  const isRu = language === 'ru';
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  useEffect(() => {
    api.getProjects().then(list => setProjects(list)).catch(() => {});
  }, [activeSection, selectedProjectId]);

  const activeProject = projects.find(p => p.id === selectedProjectId);

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
    setActiveSection('projects');
    setIsProjectDropdownOpen(false);
  };

  const handleDeleteProjectFromHeader = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    showConfirm(
      isRu ? 'Удалить проект?' : 'Delete Project?',
      isRu
        ? `Вы уверены, что хотите удалить «${p.title}» из NEXUS?`
        : `Are you sure you want to delete "${p.title}" from NEXUS?`,
      async () => {
        try {
          await api.deleteProject(p.id);
          addToast(isRu ? 'Проект удален' : 'Project deleted', p.title, 'info');
          const remaining = projects.filter(item => item.id !== p.id);
          setProjects(remaining);
          if (selectedProjectId === p.id) {
            setSelectedProjectId(remaining[0]?.id || null);
          }
        } catch (err: any) {
          addToast(isRu ? 'Ошибка удаления' : 'Delete error', String(err), 'error');
        }
      },
      true,
      isRu ? 'Удалить' : 'Delete'
    );
  };

  const handleMinimize = () => {
    api.windowMinimize();
  };

  const handleToggleMaximize = () => {
    api.windowToggleMaximize();
  };

  const handleClose = () => {
    api.windowClose();
  };

  return (
    <header
      data-tauri-drag-region
      style={
        {
          height: 38,
          backgroundColor: '#0B0B0E',
          borderBottom: '1px solid #25252D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 0 0 14px',
          userSelect: 'none',
          flexShrink: 0,
          position: 'relative',
          zIndex: 50,
          WebkitAppRegion: 'drag',
        } as React.CSSProperties
      }
    >
      {/* Left: Brand, Nav Pills, Project selector (No drag on buttons) */}
      <div
        style={
          {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties
        }
      >
        {/* Brand Logo & Version */}
        <div
          onClick={() => setActiveSection('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            cursor: 'pointer',
            paddingRight: 8,
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              backgroundColor: '#8B6CFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 1.5,
                backgroundColor: '#0B0B0E',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              letterSpacing: 1.5,
              color: '#F1F1F5',
            }}
          >
            NEXUS
          </span>
        </div>

        {/* Section Navigation Switchers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setActiveSection('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              height: 26,
              padding: '0 9px',
              borderRadius: 5,
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              border:
                activeSection === 'home'
                  ? '1px solid #25252D'
                  : '1px solid transparent',
              backgroundColor:
                activeSection === 'home' ? '#16161C' : 'transparent',
              color: activeSection === 'home' ? '#F1F1F5' : '#92929F',
              transition: 'all 0.15s ease',
            }}
          >
            <LayoutDashboard size={12} color={activeSection === 'home' ? '#8B6CFF' : 'currentColor'} />
            <span>{isRu ? 'Главная' : 'Home'}</span>
          </button>

          <button
            onClick={() => setActiveSection('projects')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              height: 26,
              padding: '0 9px',
              borderRadius: 5,
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              border:
                activeSection === 'projects'
                  ? '1px solid #25252D'
                  : '1px solid transparent',
              backgroundColor:
                activeSection === 'projects' ? '#16161C' : 'transparent',
              color: activeSection === 'projects' ? '#F1F1F5' : '#92929F',
              transition: 'all 0.15s ease',
            }}
          >
            <FolderKanban size={12} color={activeSection === 'projects' ? '#8B6CFF' : 'currentColor'} />
            <span>{isRu ? 'Проекты' : 'Projects'}</span>
          </button>

          {/* Project Switcher Dropdown */}
          {projects.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsProjectDropdownOpen(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 26,
                  padding: '0 8px',
                  borderRadius: 5,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid #25252D',
                  backgroundColor: '#111115',
                  color: activeProject ? '#A78BFA' : '#92929F',
                }}
              >
                <span
                  style={{
                    maxWidth: 130,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeProject ? activeProject.title : (isRu ? 'Выбрать...' : 'Select...')}
                </span>
                <ChevronDown size={11} />
              </button>

              {isProjectDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 32,
                    left: 0,
                    minWidth: 200,
                    backgroundColor: '#16161C',
                    border: '1px solid #25252D',
                    borderRadius: 7,
                    padding: 4,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
                    zIndex: 100,
                  }}
                >
                  {projects.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      style={{
                        padding: '6px 9px',
                        borderRadius: 4,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        color: p.id === selectedProjectId ? '#A78BFA' : '#F1F1F5',
                        backgroundColor:
                          p.id === selectedProjectId
                            ? 'rgba(139, 108, 255, 0.15)'
                            : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'rgba(139, 108, 255, 0.12)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor =
                          p.id === selectedProjectId
                            ? 'rgba(139, 108, 255, 0.15)'
                            : 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: p.cover_color || '#8b5cf6',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 130,
                          }}
                        >
                          {p.title}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.7rem', color: '#686877' }}>
                          {p.progress}%
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProjectFromHeader(e, p)}
                          title={isRu ? `Удалить «${p.title}»` : `Delete "${p.title}"`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '2px 4px',
                            cursor: 'pointer',
                            color: '#686877',
                            borderRadius: 3,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#f87171';
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = '#686877';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div
                    style={{
                      borderTop: '1px solid #25252D',
                      margin: '4px 0',
                    }}
                  />
                  <div
                    onClick={() => {
                      setSelectedProjectId(null);
                      setActiveSection('projects');
                      setIsProjectDropdownOpen(false);
                    }}
                    style={{
                      padding: '6px 9px',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      color: '#8B6CFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Plus size={12} />
                    <span>{isRu ? 'Все проекты' : 'All Projects'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Center: Draggable Window Region */}
      <div
        data-tauri-drag-region
        style={
          {
            flex: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitAppRegion: 'drag',
            cursor: 'grab',
          } as React.CSSProperties
        }
      >
        <span
          style={{
            fontSize: '0.73rem',
            color: '#686877',
            letterSpacing: 0.5,
          }}
        >
          {activeProject ? `${activeProject.title}` : 'NEXUS Workspace'}
        </span>
      </div>

      {/* Right: AI Engine status, Language, Settings, Obsidian Window Controls */}
      <div
        style={
          {
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties
        }
      >
        {/* AI Agent Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            backgroundColor: '#111115',
            border: '1px solid #25252D',
            borderRadius: 4,
            fontSize: '0.7rem',
            color: '#92929F',
            marginRight: 8,
          }}
          title="AI Assistant Engine Ready"
        >
          <Bot size={11} color="#8B6CFF" />
          <span style={{ color: '#F1F1F5', fontWeight: 600 }}>AI Ready</span>
        </div>

        {/* Language Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#111115',
            border: '1px solid #25252D',
            borderRadius: 4,
            padding: 1,
            marginRight: 6,
          }}
        >
          <button
            onClick={() => setLanguage('ru')}
            style={{
              padding: '1px 6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              borderRadius: 3,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: language === 'ru' ? 'rgba(139, 108, 255, 0.25)' : 'transparent',
              color: language === 'ru' ? '#F1F1F5' : '#686877',
            }}
          >
            RU
          </button>
          <button
            onClick={() => setLanguage('en')}
            style={{
              padding: '1px 6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              borderRadius: 3,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: language === 'en' ? 'rgba(139, 108, 255, 0.25)' : 'transparent',
              color: language === 'en' ? '#F1F1F5' : '#686877',
            }}
          >
            EN
          </button>
        </div>

        {/* Settings Button */}
        <button
          onClick={() => setActiveSection('settings')}
          style={{
            width: 32,
            height: '100%',
            backgroundColor: activeSection === 'settings' ? '#16161C' : 'transparent',
            border: 'none',
            color: activeSection === 'settings' ? '#8B6CFF' : '#92929F',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease',
          }}
          title={isRu ? 'Настройки' : 'Settings'}
        >
          <Settings size={14} />
        </button>

        {/* Obsidian-Style Window Controls (Minimize, Maximize, Close) */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <button
            onClick={handleMinimize}
            style={{
              width: 38,
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#92929F',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#16161C')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Minimize"
          >
            <Minus size={13} />
          </button>

          <button
            onClick={handleToggleMaximize}
            style={{
              width: 38,
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#92929F',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#16161C')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Maximize"
          >
            <Square size={11} />
          </button>

          <button
            onClick={handleClose}
            style={{
              width: 42,
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#92929F',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#e11d48';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#92929F';
            }}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
