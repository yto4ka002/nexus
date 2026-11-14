import { invoke } from '@tauri-apps/api/core';
import type {
  Project,
  Task,
  Note,
  LauncherItem,
  DownloadRecord,
  SystemStats,
  AutomationRule,
  ClipboardRecord,
  CalendarEvent,
  AppNotification,
  WeatherData,
  PingResult,
} from './types';

export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// ---------------- PROJECTS ----------------
export async function getProjects(): Promise<Project[]> {
  if (!isTauri()) {
    const raw = localStorage.getItem('nexus_projects');
    return raw ? JSON.parse(raw) : [];
  }
  return invoke<Project[]>('get_projects');
}

export async function createProject(payload: Partial<Project>): Promise<Project> {
  if (!isTauri()) {
    const list = await getProjects();
    const item: Project = {
      id: Date.now(),
      title: payload.title || 'New Project',
      description: payload.description || '',
      cover_color: payload.cover_color || '#8b5cf6',
      status: payload.status || 'In Progress',
      progress: payload.progress || 0,
      deadline: payload.deadline,
      notes: payload.notes || '',
      links: payload.links || '[]',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(item);
    localStorage.setItem('nexus_projects', JSON.stringify(list));
    return item;
  }
  return invoke<Project>('create_project', { payload });
}

export async function updateProject(id: number, payload: Partial<Project>): Promise<void> {
  if (!isTauri()) {
    const list = await getProjects();
    const idx = list.findIndex(p => p.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...payload, updated_at: new Date().toISOString() };
      localStorage.setItem('nexus_projects', JSON.stringify(list));
    }
    return;
  }
  return invoke<void>('update_project', { id, payload });
}

export async function deleteProject(id: number): Promise<void> {
  if (!isTauri()) {
    const list = (await getProjects()).filter(p => p.id !== id);
    localStorage.setItem('nexus_projects', JSON.stringify(list));
    return;
  }
  return invoke<void>('delete_project', { id });
}

// ---------------- GIT & CODE STUDIO ----------------
export async function readProjectFiles(dirPath: string): Promise<any[]> {
  if (!isTauri()) return [];
  return invoke<any[]>('read_project_files_cmd', { dirPath });
}

export async function saveProjectFile(filePath: string, content: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('save_project_file_cmd', { filePath, content });
}

export async function createProjectFile(filePath: string, isDir: boolean): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('create_project_file_cmd', { filePath, isDir });
}

export async function deleteProjectFile(filePath: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('delete_project_file_cmd', { filePath });
}

export async function gitStatus(repoPath?: string, projectId?: number): Promise<any> {
  if (!isTauri()) return { is_native_git: false, branch: 'main', modified: [], clean: true };
  return invoke<any>('git_status_cmd', { repoPath, projectId });
}

export async function gitCommit(
  repoPath: string | undefined,
  projectId: number | undefined,
  message: string,
  author?: string
): Promise<any> {
  if (!isTauri()) return { success: true, is_native_git: false };
  return invoke<any>('git_commit_cmd', { repoPath, projectId, message, author });
}

export async function gitPush(
  repoPath: string | undefined,
  projectId: number | undefined,
  remoteUrl?: string,
  branch?: string,
  author?: string
): Promise<any> {
  if (!isTauri()) return { success: true, is_native_git: false };
  return invoke<any>('git_push_cmd', { repoPath, projectId, remoteUrl, branch, author });
}

export async function pingDevServer(url: string): Promise<boolean> {
  if (!isTauri()) return true;
  return invoke<boolean>('ping_dev_server_cmd', { url });
}

// ---------------- GITHUB INTEGRATION ----------------
export async function githubLogin(token: string): Promise<any> {
  if (!isTauri()) {
    const mockUser = {
      login: 'developer',
      name: 'Developer',
      avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
      bio: 'NEXUS User',
      public_repos: 12,
    };
    localStorage.setItem('nexus_gh_user', JSON.stringify(mockUser));
    return mockUser;
  }
  return invoke<any>('github_login_cmd', { token });
}

export async function githubGetUser(): Promise<any> {
  if (!isTauri()) {
    const raw = localStorage.getItem('nexus_gh_user');
    return raw ? JSON.parse(raw) : null;
  }
  return invoke<any>('github_get_user_cmd');
}

export async function githubLogout(): Promise<void> {
  if (!isTauri()) {
    localStorage.removeItem('nexus_gh_user');
    return;
  }
  return invoke<void>('github_logout_cmd');
}

export async function githubListRepos(): Promise<any[]> {
  if (!isTauri()) return [];
  return invoke<any[]>('github_list_repos_cmd');
}

export async function githubSearchRepos(query: string): Promise<any[]> {
  if (!isTauri()) return [];
  return invoke<any[]>('github_search_repos_cmd', { query });
}

export async function githubImportRepo(owner: string, repo: string, branch?: string): Promise<Project> {
  if (!isTauri()) {
    const p: Project = {
      id: Date.now(),
      title: repo,
      description: `Imported from ${owner}/${repo}`,
      cover_color: '#8b5cf6',
      status: 'In Progress',
      progress: 30,
      git_remote: `https://github.com/${owner}/${repo}.git`,
      repo_path: `./projects/${repo}`,
      code_files: JSON.stringify([{ id: 'f1', name: 'README.md', path: 'README.md', language: 'markdown', content: `# ${repo}` }]),
      coworking_data: JSON.stringify({ members: [{ id: 'm1', name: owner, role: 'Owner', avatar: '🚀', status: 'active' }], messages: [], timeline: [], commits: [], activeBranch: 'main', branches: ['main'], scratchpad: '' }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return p;
  }
  return invoke<Project>('github_import_repo_cmd', { owner, repo, branch });
}

// ---------------- TASKS ----------------
export async function getTasks(projectId?: number | null): Promise<Task[]> {
  if (!isTauri()) {
    const raw = localStorage.getItem('nexus_tasks');
    const list: Task[] = raw ? JSON.parse(raw) : [];
    if (projectId) return list.filter(t => t.project_id === projectId);
    return list;
  }
  return invoke<Task[]>('get_tasks', { projectId: projectId || null });
}

export async function createTask(payload: Partial<Task>): Promise<Task> {
  if (!isTauri()) {
    const list = await getTasks();
    const task: Task = {
      id: Date.now(),
      title: payload.title || 'New Task',
      description: payload.description || '',
      priority: payload.priority || 'Normal',
      status: payload.status || 'To Do',
      due_date: payload.due_date,
      project_id: payload.project_id || null,
      kanban_column: payload.kanban_column || 'To Do',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(task);
    localStorage.setItem('nexus_tasks', JSON.stringify(list));
    return task;
  }
  return invoke<Task>('create_task', { payload });
}

export async function updateTask(id: number, payload: Partial<Task>): Promise<void> {
  if (!isTauri()) {
    const list = await getTasks();
    const idx = list.findIndex(t => t.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...payload, updated_at: new Date().toISOString() };
      localStorage.setItem('nexus_tasks', JSON.stringify(list));
    }
    return;
  }
  return invoke<void>('update_task', { id, payload });
}

export async function updateTaskColumn(id: number, kanbanColumn: string, status?: string): Promise<void> {
  if (!isTauri()) {
    const list = await getTasks();
    const idx = list.findIndex(t => t.id === id);
    if (idx !== -1) {
      list[idx].kanban_column = kanbanColumn;
      if (status) list[idx].status = status as any;
      localStorage.setItem('nexus_tasks', JSON.stringify(list));
    }
    return;
  }
  return invoke<void>('update_task_column', { id, kanbanColumn, status });
}

export async function deleteTask(id: number): Promise<void> {
  if (!isTauri()) {
    const list = (await getTasks()).filter(t => t.id !== id);
    localStorage.setItem('nexus_tasks', JSON.stringify(list));
    return;
  }
  return invoke<void>('delete_task', { id });
}

// ---------------- NOTES ----------------
export async function getNotes(): Promise<Note[]> {
  if (!isTauri()) {
    const raw = localStorage.getItem('nexus_notes');
    return raw ? JSON.parse(raw) : [
      {
        id: 1,
        title: 'Welcome to NEXUS',
        content: '# NEXUS Personal Control Center\n\nNEXUS is designed for Windows 11 as a dark futuristic command center.',
        is_pinned: true,
        tags: 'welcome,guide',
        created_at: '2026-11-11',
        updated_at: '2026-11-11',
      }
    ];
  }
  return invoke<Note[]>('get_notes');
}

export async function createNote(payload: Partial<Note>): Promise<Note> {
  if (!isTauri()) {
    const list = await getNotes();
    const note: Note = {
      id: Date.now(),
      title: payload.title || 'Untitled Note',
      content: payload.content || '',
      is_pinned: payload.is_pinned || false,
      tags: payload.tags || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(note);
    localStorage.setItem('nexus_notes', JSON.stringify(list));
    return note;
  }
  return invoke<Note>('create_note', { payload });
}

export async function updateNote(id: number, payload: Partial<Note>): Promise<void> {
  if (!isTauri()) {
    const list = await getNotes();
    const idx = list.findIndex(n => n.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...payload, updated_at: new Date().toISOString() };
      localStorage.setItem('nexus_notes', JSON.stringify(list));
    }
    return;
  }
  return invoke<void>('update_note', { id, payload });
}

export async function deleteNote(id: number): Promise<void> {
  if (!isTauri()) {
    const list = (await getNotes()).filter(n => n.id !== id);
    localStorage.setItem('nexus_notes', JSON.stringify(list));
    return;
  }
  return invoke<void>('delete_note', { id });
}

// ---------------- LAUNCHER ----------------
export async function getLauncherItems(): Promise<LauncherItem[]> {
  if (!isTauri()) {
    const raw = localStorage.getItem('nexus_launchers');
    return raw ? JSON.parse(raw) : [
      { id: 1, title: 'Task Manager', target_path: 'taskmgr.exe', icon: 'Activity', item_type: 'app', is_favorite: true, sort_order: 0 },
      { id: 2, title: 'Windows Terminal', target_path: 'wt.exe', icon: 'Terminal', item_type: 'app', is_favorite: true, sort_order: 1 },
      { id: 3, title: 'Notepad', target_path: 'notepad.exe', icon: 'FileText', item_type: 'app', is_favorite: true, sort_order: 2 },
      { id: 4, title: 'GitHub', target_path: 'https://github.com', icon: 'Globe', item_type: 'url', is_favorite: true, sort_order: 3 },
      { id: 5, title: 'YouTube', target_path: 'https://youtube.com', icon: 'PlaySquare', item_type: 'url', is_favorite: true, sort_order: 4 },
    ];
  }
  return invoke<LauncherItem[]>('get_launcher_items');
}

export async function createLauncherItem(payload: Partial<LauncherItem>): Promise<LauncherItem> {
  if (!isTauri()) {
    const list = await getLauncherItems();
    const item: LauncherItem = {
      id: Date.now(),
      title: payload.title || 'Shortcut',
      target_path: payload.target_path || '',
      icon: payload.icon || 'AppWindow',
      item_type: payload.item_type || 'app',
      is_favorite: payload.is_favorite ?? true,
      sort_order: payload.sort_order || list.length,
    };
    list.push(item);
    localStorage.setItem('nexus_launchers', JSON.stringify(list));
    return item;
  }
  return invoke<LauncherItem>('create_launcher_item', { payload });
}

export async function updateLauncherItem(id: number, payload: Partial<LauncherItem>): Promise<void> {
  if (!isTauri()) {
    const list = await getLauncherItems();
    const idx = list.findIndex(l => l.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...payload };
      localStorage.setItem('nexus_launchers', JSON.stringify(list));
    }
    return;
  }
  return invoke<void>('update_launcher_item', { id, payload });
}

export async function deleteLauncherItem(id: number): Promise<void> {
  if (!isTauri()) {
    const list = (await getLauncherItems()).filter(l => l.id !== id);
    localStorage.setItem('nexus_launchers', JSON.stringify(list));
    return;
  }
  return invoke<void>('delete_launcher_item', { id });
}

export async function launchTarget(target: string): Promise<string> {
  if (!isTauri()) {
    window.open(target, '_blank');
    return `Opened ${target}`;
  }
  return invoke<string>('launch_target', { target });
}

// ---------------- SYSTEM ----------------
export async function getSystemStats(): Promise<SystemStats> {
  if (!isTauri()) {
    return {
      cpu_name: 'AMD Ryzen 9 / Intel Core i9 Gen-14',
      cpu_cores: 16,
      cpu_overall_percent: 18.4,
      cpu_cores_detail: Array.from({ length: 16 }).map((_, i) => ({
        name: `Core ${i}`,
        usage: Math.round(Math.random() * 40 + 5),
        frequency: 4200,
      })),
      ram_total_mb: 32768,
      ram_used_mb: 12450,
      ram_free_mb: 20318,
      ram_percent: 38.0,
      disks: [
        {
          name: 'Local Disk (C:)',
          mount_point: 'C:\\',
          total_gb: 953.8,
          available_gb: 412.3,
          used_gb: 541.5,
          usage_percent: 56.8,
          file_system: 'NTFS',
          is_removable: false,
        }
      ],
      net_rx_speed_kb: 142.5,
      net_tx_speed_kb: 45.2,
      net_total_rx_mb: 18400.2,
      net_total_tx_mb: 5200.7,
      gpu_available: false,
      gpu_name: 'Hardware accelerated graphics',
      gpu_usage_percent: null,
      top_processes: [
        { pid: 1420, name: 'nexus.exe', memory_mb: 95.2, cpu_percent: 1.2 },
        { pid: 3824, name: 'msedge.exe', memory_mb: 612.4, cpu_percent: 3.4 },
        { pid: 4910, name: 'explorer.exe', memory_mb: 148.0, cpu_percent: 0.8 },
      ],
      uptime_seconds: 48200,
    };
  }
  return invoke<SystemStats>('get_system_stats');
}

export async function killProcess(pid: number): Promise<boolean> {
  if (!isTauri()) return true;
  return invoke<boolean>('kill_process_cmd', { pid });
}

export async function runSystemCommand(cmd: string): Promise<string> {
  if (!isTauri()) return `Simulated execution of ${cmd}`;
  return invoke<string>('run_system_command', { cmd });
}

// ---------------- DOWNLOADS ----------------
export async function getDownloads(): Promise<DownloadRecord[]> {
  if (!isTauri()) {
    const raw = localStorage.getItem('nexus_downloads');
    return raw ? JSON.parse(raw) : [];
  }
  return invoke<DownloadRecord[]>('get_downloads');
}

export async function startDownload(url: string, customFilename?: string, customDir?: string): Promise<number> {
  if (!isTauri()) {
    const list = await getDownloads();
    const record: DownloadRecord = {
      id: Date.now(),
      url,
      file_name: customFilename || url.split('/').pop() || 'file.bin',
      file_path: `C:\\Downloads\\${customFilename || 'file.bin'}`,
      total_bytes: 104857600,
      downloaded_bytes: 45000000,
      speed_bytes_sec: 2500000,
      status: 'downloading',
      category: 'Other',
      created_at: new Date().toISOString(),
    };
    list.unshift(record);
    localStorage.setItem('nexus_downloads', JSON.stringify(list));
    return record.id;
  }
  return invoke<number>('start_download_cmd', { url, customFilename, customDir });
}

export async function cancelDownload(id: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('cancel_download_cmd', { id });
}

export async function openDownloadFile(id: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('open_download_file', { id });
}

export async function openDownloadFolder(id: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('open_download_folder', { id });
}

export async function deleteDownload(id: number, deleteFile: boolean = false): Promise<void> {
  if (!isTauri()) {
    const list = (await getDownloads()).filter(d => d.id !== id);
    localStorage.setItem('nexus_downloads', JSON.stringify(list));
    return;
  }
  return invoke<void>('delete_download', { id, deleteFile });
}

// ---------------- CLIPBOARD ----------------
export async function syncClipboard(): Promise<ClipboardRecord | null> {
  if (!isTauri()) return null;
  return invoke<ClipboardRecord | null>('sync_clipboard_cmd');
}

export async function getClipboardHistory(): Promise<ClipboardRecord[]> {
  if (!isTauri()) {
    const raw = localStorage.getItem('nexus_clipboard');
    return raw ? JSON.parse(raw) : [
      { id: 1, content_type: 'text', content: 'NEXUS Command Palette Shortcut: Ctrl + Space', is_pinned: true, is_favorite: true, created_at: '2026-11-11' }
    ];
  }
  return invoke<ClipboardRecord[]>('get_clipboard_history');
}

export async function setClipboardText(text: string): Promise<void> {
  if (!isTauri()) {
    navigator.clipboard.writeText(text);
    return;
  }
  return invoke<void>('set_clipboard_text_cmd', { text });
}

export async function toggleClipboardPin(id: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('toggle_clipboard_pin', { id });
}

export async function toggleClipboardFavorite(id: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('toggle_clipboard_favorite', { id });
}

export async function deleteClipboardItem(id: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('delete_clipboard_item', { id });
}

export async function clearClipboardHistory(): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('clear_clipboard_history');
}

// ---------------- CALENDAR ----------------
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  if (!isTauri()) {
    const raw = localStorage.getItem('nexus_calendar');
    return raw ? JSON.parse(raw) : [
      {
        id: 1,
        title: 'Sprint Review & Planning',
        description: 'Review Kusayra milestones and upcoming releases',
        start_time: '2026-11-15T14:00:00',
        end_time: '2026-11-15T15:30:00',
        category: 'Work',
        project_id: 1,
        is_recurring: false,
        created_at: '2026-11-11',
      }
    ];
  }
  return invoke<CalendarEvent[]>('get_calendar_events');
}

export async function createCalendarEvent(payload: Partial<CalendarEvent>): Promise<CalendarEvent> {
  if (!isTauri()) {
    const list = await getCalendarEvents();
    const ev: CalendarEvent = {
      id: Date.now(),
      title: payload.title || 'New Event',
      description: payload.description || '',
      start_time: payload.start_time || new Date().toISOString(),
      end_time: payload.end_time || new Date().toISOString(),
      category: payload.category || 'Work',
      project_id: payload.project_id || null,
      is_recurring: payload.is_recurring || false,
      created_at: new Date().toISOString(),
    };
    list.push(ev);
    localStorage.setItem('nexus_calendar', JSON.stringify(list));
    return ev;
  }
  return invoke<CalendarEvent>('create_calendar_event', { payload });
}

export async function updateCalendarEvent(id: number, payload: Partial<CalendarEvent>): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('update_calendar_event', { id, payload });
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('delete_calendar_event', { id });
}

// ---------------- AUTOMATION ----------------
export async function getAutomationRules(): Promise<AutomationRule[]> {
  if (!isTauri()) {
    return [
      {
        id: 1,
        title: 'Morning Workspace Reminder',
        trigger_type: 'daily_time',
        trigger_val: '09:00',
        action_type: 'notification',
        action_payload: 'Good morning! Review pending tasks in NEXUS.',
        is_active: true,
        created_at: '2026-11-11',
      }
    ];
  }
  return invoke<AutomationRule[]>('get_automation_rules');
}

export async function createAutomationRule(payload: Partial<AutomationRule>): Promise<AutomationRule> {
  if (!isTauri()) {
    return {
      id: Date.now(),
      title: payload.title || 'Rule',
      trigger_type: payload.trigger_type || 'daily_time',
      trigger_val: payload.trigger_val || '10:00',
      action_type: payload.action_type || 'notification',
      action_payload: payload.action_payload || '',
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }
  return invoke<AutomationRule>('create_automation_rule', { payload });
}

export async function toggleAutomationRule(id: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('toggle_automation_rule', { id });
}

export async function deleteAutomationRule(id: number): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('delete_automation_rule', { id });
}

export async function executeAutomationRuleNow(id: number): Promise<string> {
  if (!isTauri()) return 'Executed in simulation mode';
  return invoke<string>('execute_automation_rule_now', { id });
}

// ---------------- WEATHER & TOOLS ----------------
export async function fetchWeather(city?: string): Promise<WeatherData> {
  if (!isTauri()) {
    return {
      temperature: 18.5,
      weather_code: 1,
      condition_text: 'Partly Cloudy',
      wind_speed: 3.4,
      humidity: 58,
      location_name: city || 'Local Station',
      updated_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_cached: false,
    };
  }
  return invoke<WeatherData>('fetch_weather', { city });
}

export async function checkWebsitePing(url: string): Promise<PingResult> {
  if (!isTauri()) {
    return {
      url,
      status_code: 200,
      latency_ms: 42,
      is_online: true,
    };
  }
  return invoke<PingResult>('check_website_ping', { url });
}

// ---------------- NOTIFICATIONS ----------------
export async function getNotifications(): Promise<AppNotification[]> {
  if (!isTauri()) {
    return [
      {
        id: 1,
        title: 'System Initialized',
        message: 'NEXUS v1.0.0 is online and operating locally.',
        notif_type: 'success',
        is_read: false,
        created_at: 'Just now',
      }
    ];
  }
  return invoke<AppNotification[]>('get_notifications');
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('mark_all_notifications_read');
}

export async function clearAllNotifications(): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('clear_all_notifications');
}

// ---------------- SETTINGS & BACKUP ----------------
export async function getAppSettings(): Promise<Record<string, any>> {
  if (!isTauri()) {
    const raw = localStorage.getItem('nexus_settings');
    return raw ? JSON.parse(raw) : {
      theme: 'midnight-violet',
      accentColor: '#8b5cf6',
      closeToTray: true,
      autostart: true,
      quickAccessHotkey: 'Ctrl+Space',
      clipboardLimit: 50,
      systemRefreshInterval: 2000,
    };
  }
  return invoke<Record<string, any>>('get_app_settings');
}

export async function getAppSetting(key: string): Promise<any> {
  const current = await getAppSettings();
  return current[key];
}

export async function saveAppSetting(key: string, value: any): Promise<void> {
  if (!isTauri()) {
    const current = await getAppSettings();
    current[key] = value;
    localStorage.setItem('nexus_settings', JSON.stringify(current));
    return;
  }
  return invoke<void>('save_app_setting', { key, value });
}

export async function setAutostart(enabled: boolean): Promise<boolean> {
  if (!isTauri()) return enabled;
  return invoke<boolean>('set_autostart_cmd', { enabled });
}

export async function isAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>('is_autostart_enabled_cmd');
}

export async function exportBackupJson(): Promise<string> {
  if (!isTauri()) return JSON.stringify({ message: 'Backup simulated' }, null, 2);
  return invoke<string>('export_backup_json');
}

export async function importBackupJson(jsonContent: string): Promise<string> {
  if (!isTauri()) return 'Restored in simulation';
  return invoke<string>('import_backup_json', { jsonContent });
}

export async function getDbPath(): Promise<string> {
  if (!isTauri()) return 'Local Storage (Browser Mode)';
  return invoke<string>('get_db_path');
}

// ---------------- MULTIMEDIA & BROWSER MUSIC ----------------

export async function sendSystemMediaKey(key: 'play_pause' | 'next' | 'prev' | 'stop' | 'volume_up' | 'volume_down' | 'volume_mute'): Promise<string> {
  if (!isTauri()) {
    console.log('[MediaKey Simulation]:', key);
    return `Simulated ${key}`;
  }
  return invoke<string>('send_system_media_key', { key });
}

export async function openMusicService(service: string): Promise<string> {
  if (!isTauri()) {
    const urls: Record<string, string> = {
      youtube: 'https://music.youtube.com',
      spotify: 'https://open.spotify.com',
      yandex: 'https://music.yandex.ru',
      soundcloud: 'https://soundcloud.com',
      vk: 'https://vk.com/audio',
      lofigirl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      nightwave: 'https://nightride.fm',
    };
    const target = urls[service] || service;
    window.open(target, '_blank');
    return `Opened ${target}`;
  }
  return invoke<string>('open_music_service', { service });
}

// ---------------- WINDOW CONTROLS (Obsidian Style) ----------------
export async function windowMinimize(): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('window_minimize_cmd');
}

export async function windowToggleMaximize(): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('window_toggle_maximize_cmd');
}

export async function windowClose(): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('window_close_cmd');
}

// ---------------- TERMINAL ----------------
export interface TerminalResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}

export async function runProjectTerminal(dirPath: string | undefined, command: string): Promise<TerminalResult> {
  if (!isTauri()) {
    return {
      stdout: `[Simulated Terminal: ${command}]\nCompleted successfully in browser demo mode.`,
      stderr: '',
      exit_code: 0,
      duration_ms: 120,
    };
  }
  return invoke<TerminalResult>('run_project_terminal_cmd', { dirPath, command });
}

// ---------------- GIT DIFF ----------------
export async function gitDiff(repoPath?: string, filePath?: string): Promise<string> {
  if (!isTauri()) return '';
  return invoke<string>('git_diff_cmd', { repoPath, filePath });
}

// ---------------- CHECKPOINTS ----------------
export interface CheckpointRecord {
  id: number;
  project_id: number;
  name: string;
  description: string;
  created_at: string;
  bytes?: number;
}

export async function createCheckpoint(projectId: number, name: string, description: string | undefined, codeFiles: string): Promise<CheckpointRecord> {
  if (!isTauri()) {
    const id = Date.now();
    return { id, project_id: projectId, name, description: description || '', created_at: 'Just now' };
  }
  return invoke<CheckpointRecord>('create_checkpoint_cmd', { projectId, name, description, codeFiles });
}

export async function listCheckpoints(projectId: number): Promise<CheckpointRecord[]> {
  if (!isTauri()) return [];
  return invoke<CheckpointRecord[]>('list_checkpoints_cmd', { projectId });
}

export async function restoreCheckpoint(checkpointId: number): Promise<string> {
  if (!isTauri()) return '[]';
  return invoke<string>('restore_checkpoint_cmd', { checkpointId });
}

// ---------------- ACTIVITY LOGS ----------------
export interface ActivityRecord {
  id: number;
  project_id?: number | null;
  event_type: 'file_edit' | 'git_commit' | 'git_push' | 'ai_action' | 'checkpoint' | 'terminal';
  description: string;
  metadata?: string;
  created_at: string;
}

export async function logActivity(projectId: number | null, eventType: string, description: string, metadata?: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('log_activity_cmd', { projectId, eventType, description, metadata });
}

export async function getActivities(projectId?: number): Promise<ActivityRecord[]> {
  if (!isTauri()) return [];
  return invoke<ActivityRecord[]>('get_activities_cmd', { projectId });
}

// ---------------- AI CHAT & AGENT API ----------------
export async function aiChat(
  provider: string,
  model: string,
  apiKey: string | undefined,
  endpoint: string | undefined,
  systemPrompt: string,
  userPrompt: string,
  codeContext?: string
): Promise<string> {
  if (!isTauri()) {
    return `[AI Simulation (${provider} / ${model})]: I analyzed the project context. To connect live models, run NEXUS in desktop mode with your API key or local Ollama.`;
  }
  return invoke<string>('ai_chat_cmd', {
    provider,
    model,
    apiKey,
    endpoint,
    systemPrompt,
    userPrompt,
    codeContext,
  });
}

// ---------------- GITHUB PRs & ISSUES ----------------
export async function githubGetPullRequests(owner: string, repo: string): Promise<any[]> {
  if (!isTauri()) return [];
  return invoke<any[]>('github_get_pull_requests_cmd', { owner, repo });
}

export async function githubGetIssues(owner: string, repo: string): Promise<any[]> {
  if (!isTauri()) return [];
  return invoke<any[]>('github_get_issues_cmd', { owner, repo });
}
