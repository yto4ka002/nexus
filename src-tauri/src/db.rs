use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
    pub db_path: PathBuf,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub cover_color: String,
    pub status: String,
    pub progress: i32,
    pub deadline: Option<String>,
    pub notes: Option<String>,
    pub links: Option<String>,
    pub repo_path: Option<String>,
    pub git_remote: Option<String>,
    pub code_files: Option<String>,
    pub coworking_data: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub priority: String, // Low, Normal, High, Critical
    pub status: String,   // To Do, In Progress, Done, Cancelled
    pub due_date: Option<String>,
    pub project_id: Option<i64>,
    pub kanban_column: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub is_pinned: bool,
    pub tags: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherItem {
    pub id: i64,
    pub title: String,
    pub target_path: String,
    pub icon: String,
    pub item_type: String, // "app", "url", "file", "command"
    pub is_favorite: bool,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadRecord {
    pub id: i64,
    pub url: String,
    pub file_name: String,
    pub file_path: String,
    pub total_bytes: i64,
    pub downloaded_bytes: i64,
    pub speed_bytes_sec: i64,
    pub status: String, // "downloading", "paused", "completed", "error", "cancelled"
    pub category: String,
    pub error_message: Option<String>,
    pub created_at: String,
    pub finished_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AutomationRule {
    pub id: i64,
    pub title: String,
    pub trigger_type: String, // "daily_time", "interval_mins"
    pub trigger_val: String,  // e.g. "09:00" or "60"
    pub action_type: String,  // "launch_app", "open_url", "notification", "empty_trash"
    pub action_payload: String,
    pub is_active: bool,
    pub last_run: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClipboardRecord {
    pub id: i64,
    pub content_type: String, // "text", "link"
    pub content: String,
    pub is_pinned: bool,
    pub is_favorite: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEvent {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub start_time: String,
    pub end_time: String,
    pub category: String,
    pub project_id: Option<i64>,
    pub is_recurring: bool,
    pub recurrence_rule: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppNotification {
    pub id: i64,
    pub title: String,
    pub message: String,
    pub notif_type: String, // "info", "success", "warning", "error", "reminder"
    pub is_read: bool,
    pub created_at: String,
}

pub fn init_db() -> Result<DbState, Box<dyn std::error::Error>> {
    let mut dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("NEXUS");
    fs::create_dir_all(&dir)?;
    let db_path = dir.join("nexus.db");

    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for concurrent access and high performance
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;")?;

    // Create tables
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            cover_color TEXT DEFAULT '#8b5cf6',
            status TEXT DEFAULT 'In Progress',
            progress INTEGER DEFAULT 0,
            deadline TEXT,
            notes TEXT DEFAULT '',
            links TEXT DEFAULT '[]',
            repo_path TEXT DEFAULT '',
            git_remote TEXT DEFAULT '',
            code_files TEXT DEFAULT '[]',
            coworking_data TEXT DEFAULT '{}',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            priority TEXT DEFAULT 'Normal',
            status TEXT DEFAULT 'To Do',
            due_date TEXT,
            project_id INTEGER,
            kanban_column TEXT DEFAULT 'To Do',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            is_pinned INTEGER DEFAULT 0,
            tags TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS launcher_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            target_path TEXT NOT NULL,
            icon TEXT DEFAULT 'AppWindow',
            item_type TEXT DEFAULT 'app',
            is_favorite INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            total_bytes INTEGER DEFAULT 0,
            downloaded_bytes INTEGER DEFAULT 0,
            speed_bytes_sec INTEGER DEFAULT 0,
            status TEXT DEFAULT 'completed',
            category TEXT DEFAULT 'Other',
            error_message TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            finished_at TEXT
        );

        CREATE TABLE IF NOT EXISTS automation_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            trigger_type TEXT DEFAULT 'daily_time',
            trigger_val TEXT DEFAULT '09:00',
            action_type TEXT DEFAULT 'notification',
            action_payload TEXT DEFAULT 'Welcome to your workspace',
            is_active INTEGER DEFAULT 1,
            last_run TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS clipboard_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content_type TEXT DEFAULT 'text',
            content TEXT NOT NULL,
            is_pinned INTEGER DEFAULT 0,
            is_favorite INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS calendar_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            category TEXT DEFAULT 'Work',
            project_id INTEGER,
            is_recurring INTEGER DEFAULT 0,
            recurrence_rule TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_checkpoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            code_files TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            event_type TEXT NOT NULL,
            description TEXT NOT NULL,
            metadata TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            notif_type TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        "#
    )?;

    // Safe dynamic column migrations
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN repo_path TEXT DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN git_remote TEXT DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN code_files TEXT DEFAULT '[]'", []);
    let _ = conn.execute("ALTER TABLE projects ADD COLUMN coworking_data TEXT DEFAULT '{}'", []);

    // Purge demo examples so users have a clean project workspace
    let _ = conn.execute("DELETE FROM projects WHERE title = 'Kusayra'", []);
    let _ = conn.execute("DELETE FROM tasks WHERE project_id IS NULL AND (title LIKE '%telemetry%' OR title LIKE '%Kusayra%' OR title LIKE '%Review daily%')", []);
    let _ = conn.execute("DELETE FROM calendar_events WHERE title LIKE '%Kusayra%' OR title LIKE '%Sprint Review%'", []);

    // Check if initial system seed is needed
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0)).unwrap_or(0);
    if count == 0 {
        // Seed welcome note
        conn.execute(
            r#"INSERT INTO notes (title, content, is_pinned, tags)
               VALUES (?1, ?2, 1, ?3)"#,
            params![
                "Welcome to NEXUS",
                "# NEXUS System Overview\n\nNEXUS is your unified personal command and control center for Windows 11.\n\n### Key Features:\n- **GitHub Integration**: Connect your account and import any repository with real code files, commit log and team members.\n- **Projects & Kanban**: Modular board with Code Studio and Live Preview.\n- **System**: Live CPU, RAM, Disk, Network and Process monitoring.\n- **Quick Access**: Summon anytime with `Ctrl + Space`.\n\nEnjoy your futuristic workflow!",
                "welcome,guide"
            ],
        )?;

        // Seed launcher items
        let default_launchers = vec![
            ("Task Manager", "taskmgr.exe", "Activity", "app", 1, 0),
            ("Windows Terminal", "wt.exe", "Terminal", "app", 1, 1),
            ("Notepad", "notepad.exe", "FileText", "app", 1, 2),
            ("Calculator", "calc.exe", "Calculator", "app", 1, 3),
            ("GitHub", "https://github.com", "Globe", "url", 1, 4),
            ("YouTube", "https://youtube.com", "PlaySquare", "url", 1, 5),
        ];

        for item in default_launchers {
            conn.execute(
                r#"INSERT INTO launcher_items (title, target_path, icon, item_type, is_favorite, sort_order)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6)"#,
                params![item.0, item.1, item.2, item.3, item.4, item.5],
            )?;
        }

        // Seed a default automation rule
        conn.execute(
            r#"INSERT INTO automation_rules (title, trigger_type, trigger_val, action_type, action_payload, is_active)
               VALUES (?1, ?2, ?3, ?4, ?5, 1)"#,
            params![
                "Morning Workspace Reminder",
                "daily_time",
                "09:00",
                "notification",
                "Good morning! Review your pending tasks on NEXUS."
            ],
        )?;

        // Seed initial notification
        conn.execute(
            r#"INSERT INTO notifications (title, message, notif_type)
               VALUES (?1, ?2, ?3)"#,
            params![
                "System Initialized",
                "NEXUS v1.0.0 is online and operating locally.",
                "success"
            ],
        )?;
    }

    Ok(DbState {
        conn: Mutex::new(conn),
        db_path,
    })
}
