export type SectionType =
  | 'home'
  | 'projects'
  | 'settings';

export interface ProjectChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  priority?: 'low' | 'normal' | 'high';
  created_at: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  cover_color: string;
  status: string;
  progress: number;
  deadline?: string;
  notes?: string;
  links?: string;
  repo_path?: string;
  git_remote?: string;
  git_branch?: string;
  code_files?: string;
  coworking_data?: string;
  ai_context?: string;
  ai_permissions?: string;
  created_at: string;
  updated_at: string;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';
  apiKey?: string;
  endpoint?: string;
  defaultModel: string;
  isActive: boolean;
}

export interface AIPermissions {
  fileWrite: 'allow' | 'ask' | 'deny';
  fileDelete: 'allow' | 'ask' | 'deny';
  terminalExec: 'allow' | 'ask' | 'deny';
}

export interface ProjectAIContext {
  architecture: string;
  techStack: string[];
  conventions: string;
  rules: string;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  tags: string[];
  files: { name: string; path: string; language: string; content: string }[];
}

export interface CodeFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'active' | 'coding' | 'reviewing' | 'away';
}

export interface CoworkingMessage {
  id: string;
  author: string;
  avatar: string;
  time: string;
  text: string;
}

export interface TimelineEvent {
  id: string;
  user: string;
  action: string;
  time: string;
  type: 'commit' | 'push' | 'task' | 'branch' | 'review';
}

export interface GitCommitItem {
  hash: string;
  message: string;
  author: string;
  branch: string;
  time: string;
}

export interface CoworkingData {
  members: TeamMember[];
  messages: CoworkingMessage[];
  timeline: TimelineEvent[];
  commits: GitCommitItem[];
  activeBranch: string;
  branches: string[];
  scratchpad: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'Low' | 'Normal' | 'High' | 'Critical';
  status: 'To Do' | 'In Progress' | 'Done' | 'Cancelled';
  due_date?: string;
  project_id?: number | null;
  kanban_column?: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  tags: string;
  created_at: string;
  updated_at: string;
}

export interface LauncherItem {
  id: number;
  title: string;
  target_path: string;
  icon: string;
  item_type: 'app' | 'url' | 'file' | 'command' | 'project';
  is_favorite: boolean;
  sort_order: number;
  project_id?: number | null;
}

export interface DownloadRecord {
  id: number;
  url: string;
  file_name: string;
  file_path: string;
  total_bytes: number;
  downloaded_bytes: number;
  speed_bytes_sec: number;
  status: 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  category: string;
  error_message?: string;
  created_at: string;
  finished_at?: string;
}

export interface CpuCoreInfo {
  name: string;
  usage: number;
  frequency: number;
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_gb: number;
  available_gb: number;
  used_gb: number;
  usage_percent: number;
  file_system: string;
  is_removable: boolean;
}

export interface ProcessItem {
  pid: number;
  name: string;
  memory_mb: number;
  cpu_percent: number;
}

export interface SystemStats {
  cpu_name: string;
  cpu_cores: number;
  cpu_overall_percent: number;
  cpu_cores_detail: CpuCoreInfo[];
  ram_total_mb: number;
  ram_used_mb: number;
  ram_free_mb: number;
  ram_percent: number;
  disks: DiskInfo[];
  net_rx_speed_kb: number;
  net_tx_speed_kb: number;
  net_total_rx_mb: number;
  net_total_tx_mb: number;
  gpu_available: boolean;
  gpu_name: string;
  gpu_usage_percent?: number | null;
  top_processes: ProcessItem[];
  uptime_seconds: number;
}

export interface AutomationRule {
  id: number;
  title: string;
  trigger_type: string;
  trigger_val: string;
  action_type: string;
  action_payload: string;
  is_active: boolean;
  last_run?: string;
  created_at: string;
}

export interface ClipboardRecord {
  id: number;
  content_type: 'text' | 'link';
  content: string;
  is_pinned: boolean;
  is_favorite: boolean;
  created_at: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  category: string;
  project_id?: number | null;
  is_recurring: boolean;
  recurrence_rule?: string;
  created_at: string;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  notif_type: 'info' | 'success' | 'warning' | 'error' | 'reminder';
  is_read: boolean;
  created_at: string;
}

export interface WeatherData {
  temperature: number;
  weather_code: number;
  condition_text: string;
  wind_speed: number;
  humidity: number;
  location_name: string;
  updated_at: string;
  is_cached: boolean;
}

export interface PingResult {
  url: string;
  status_code: number;
  latency_ms: number;
  is_online: boolean;
  error_msg?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'info' | 'success' | 'warning' | 'error';
}
