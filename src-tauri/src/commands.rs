use crate::clipboard::ClipboardState;
use crate::db::*;
use crate::downloader::{categorize_file, DownloaderState};
use crate::system_monitor::{MonitorState, SystemStats};
use futures_util::StreamExt;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::time::Instant;
use tauri::{AppHandle, Manager, State};
use tokio::io::AsyncWriteExt;

// ---------------- PROJECTS ----------------

#[tauri::command]
pub fn get_projects(db: State<'_, DbState>) -> Result<Vec<Project>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, title, description, cover_color, status, progress, deadline, notes, links, repo_path, git_remote, code_files, coworking_data, created_at, updated_at FROM projects ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                cover_color: row.get(3)?,
                status: row.get(4)?,
                progress: row.get(5)?,
                deadline: row.get(6)?,
                notes: row.get(7)?,
                links: row.get(8)?,
                repo_path: row.get(9)?,
                git_remote: row.get(10)?,
                code_files: row.get(11)?,
                coworking_data: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[derive(Deserialize)]
pub struct ProjectPayload {
    pub title: String,
    pub description: Option<String>,
    pub cover_color: Option<String>,
    pub status: Option<String>,
    pub progress: Option<i32>,
    pub deadline: Option<String>,
    pub notes: Option<String>,
    pub links: Option<String>,
    pub repo_path: Option<String>,
    pub git_remote: Option<String>,
    pub code_files: Option<String>,
    pub coworking_data: Option<String>,
}

#[tauri::command]
pub fn create_project(payload: ProjectPayload, db: State<'_, DbState>) -> Result<Project, String> {
    let conn = db.conn.lock().unwrap();
    let desc = payload.description.unwrap_or_default();
    let color = payload.cover_color.unwrap_or_else(|| "#8b5cf6".to_string());
    let status = payload.status.unwrap_or_else(|| "In Progress".to_string());
    let progress = payload.progress.unwrap_or(0);
    let notes = payload.notes.unwrap_or_default();
    let links = payload.links.unwrap_or_else(|| "[]".to_string());
    let repo_path = payload.repo_path.unwrap_or_default();
    let git_remote = payload.git_remote.unwrap_or_default();
    let code_files = payload.code_files.unwrap_or_else(|| "[]".to_string());
    let coworking_data = payload.coworking_data.unwrap_or_else(|| "{}".to_string());

    conn.execute(
        "INSERT INTO projects (title, description, cover_color, status, progress, deadline, notes, links, repo_path, git_remote, code_files, coworking_data) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![payload.title, desc, color, status, progress, payload.deadline, notes, links, repo_path, git_remote, code_files, coworking_data],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Project {
        id,
        title: payload.title,
        description: desc,
        cover_color: color,
        status,
        progress,
        deadline: payload.deadline,
        notes: Some(notes),
        links: Some(links),
        repo_path: Some(repo_path),
        git_remote: Some(git_remote),
        code_files: Some(code_files),
        coworking_data: Some(coworking_data),
        created_at: "Just now".to_string(),
        updated_at: "Just now".to_string(),
    })
}

#[tauri::command]
pub fn update_project(id: i64, payload: ProjectPayload, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let desc = payload.description.unwrap_or_default();
    let color = payload.cover_color.unwrap_or_else(|| "#8b5cf6".to_string());
    let status = payload.status.unwrap_or_else(|| "In Progress".to_string());
    let progress = payload.progress.unwrap_or(0);
    let notes = payload.notes.unwrap_or_default();
    let links = payload.links.unwrap_or_else(|| "[]".to_string());
    let repo_path = payload.repo_path.unwrap_or_default();
    let git_remote = payload.git_remote.unwrap_or_default();
    let code_files = payload.code_files.unwrap_or_else(|| "[]".to_string());
    let coworking_data = payload.coworking_data.unwrap_or_else(|| "{}".to_string());

    conn.execute(
        "UPDATE projects SET title = ?1, description = ?2, cover_color = ?3, status = ?4, progress = ?5, deadline = ?6, notes = ?7, links = ?8, repo_path = ?9, git_remote = ?10, code_files = ?11, coworking_data = ?12, updated_at = CURRENT_TIMESTAMP WHERE id = ?13",
        params![payload.title, desc, color, status, progress, payload.deadline, notes, links, repo_path, git_remote, code_files, coworking_data, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_project(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- GIT & CODE STUDIO ----------------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[tauri::command]
pub fn read_project_files_cmd(dir_path: String) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&dir_path);
    if !path.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }

    let mut entries = Vec::new();
    if let Ok(read_dir) = fs::read_dir(path) {
        for entry in read_dir.flatten() {
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let file_name = entry.file_name().to_string_lossy().to_string();
            // Skip hidden git or node_modules
            if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" {
                continue;
            }
            entries.push(FileEntry {
                name: file_name,
                path: entry.path().to_string_lossy().to_string(),
                is_dir: meta.is_dir(),
                size: meta.len(),
            });
        }
    }
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(entries)
}

#[tauri::command]
pub fn save_project_file_cmd(file_path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_project_file_cmd(file_path: String, is_dir: bool) -> Result<(), String> {
    let path = Path::new(&file_path);
    if is_dir {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
    } else {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(path, "").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_project_file_cmd(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn git_status_cmd(
    repo_path: Option<String>,
    project_id: Option<i64>,
    db: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    // Check if git CLI is available and repo_path exists
    let has_git_cli = std::process::Command::new("git").arg("--version").output().is_ok();

    if let Some(ref path_str) = repo_path {
        let path = Path::new(path_str);
        if has_git_cli && path.exists() && path.join(".git").exists() {
            let status_out = std::process::Command::new("git")
                .current_dir(path)
                .args(&["status", "--porcelain"])
                .output();

            let branch_out = std::process::Command::new("git")
                .current_dir(path)
                .args(&["branch", "--show-current"])
                .output();

            if let (Ok(s), Ok(b)) = (status_out, branch_out) {
                let status_text = String::from_utf8_lossy(&s.stdout).to_string();
                let branch = String::from_utf8_lossy(&b.stdout).trim().to_string();

                let mut modified_files = Vec::new();
                for line in status_text.lines() {
                    if line.len() > 3 {
                        let code = line[0..2].trim().to_string();
                        let file = line[3..].trim().to_string();
                        modified_files.push(serde_json::json!({
                            "status": code,
                            "path": file
                        }));
                    }
                }

                return Ok(serde_json::json!({
                    "is_native_git": true,
                    "branch": if branch.is_empty() { "main".to_string() } else { branch },
                    "modified": modified_files,
                    "clean": modified_files.is_empty(),
                    "output": status_text
                }));
            }
        }
    }

    // Fallback: Virtual Git state from SQLite
    if let Some(pid) = project_id {
        let conn = db.conn.lock().unwrap();
        let coworking: Option<String> = conn
            .query_row("SELECT coworking_data FROM projects WHERE id = ?1", params![pid], |r| r.get(0))
            .ok();

        if let Some(cw_str) = coworking {
            if let Ok(cw) = serde_json::from_str::<serde_json::Value>(&cw_str) {
                let branch = cw["activeBranch"].as_str().unwrap_or("main");
                let commits = cw["commits"].as_array();
                return Ok(serde_json::json!({
                    "is_native_git": false,
                    "branch": branch,
                    "modified": [],
                    "clean": true,
                    "commits_count": commits.map(|c| c.len()).unwrap_or(0),
                    "branches": cw["branches"]
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "is_native_git": false,
        "branch": "main",
        "modified": [],
        "clean": true
    }))
}

#[tauri::command]
pub fn git_commit_cmd(
    repo_path: Option<String>,
    project_id: Option<i64>,
    message: String,
    author: Option<String>,
    db: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let author_name = author.unwrap_or_else(|| "NEXUS User".to_string());
    let has_git_cli = std::process::Command::new("git").arg("--version").output().is_ok();

    if let Some(ref path_str) = repo_path {
        let path = Path::new(path_str);
        if has_git_cli && path.exists() && path.join(".git").exists() {
            let _ = std::process::Command::new("git")
                .current_dir(path)
                .args(&["add", "-A"])
                .output();

            let commit_res = std::process::Command::new("git")
                .current_dir(path)
                .args(&["commit", "-m", &message])
                .output();

            if let Ok(out) = commit_res {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                return Ok(serde_json::json!({
                    "success": out.status.success(),
                    "output": stdout,
                    "is_native_git": true
                }));
            }
        }
    }

    // In-app Virtual Commit recorded into SQLite
    if let Some(pid) = project_id {
        let conn = db.conn.lock().unwrap();
        let mut coworking_str: String = conn
            .query_row("SELECT coworking_data FROM projects WHERE id = ?1", params![pid], |r| r.get(0))
            .unwrap_or_else(|_| "{}".to_string());

        let mut cw: serde_json::Value = serde_json::from_str(&coworking_str).unwrap_or(serde_json::json!({}));
        
        let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis().to_string();
        let short_hash = if ts.len() >= 7 { &ts[ts.len() - 7..] } else { &ts };
        let branch = cw["activeBranch"].as_str().unwrap_or("main").to_string();
        let now_str = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();

        let new_commit = serde_json::json!({
            "hash": short_hash,
            "message": message,
            "author": author_name,
            "branch": branch,
            "time": now_str
        });

        if let Some(arr) = cw["commits"].as_array_mut() {
            arr.insert(0, new_commit);
        } else {
            cw["commits"] = serde_json::json!([new_commit]);
        }

        let new_timeline_event = serde_json::json!({
            "id": format!("t-{}", ts),
            "user": author_name,
            "action": format!("Закоммитил: {}", message),
            "time": "только что",
            "type": "commit"
        });

        if let Some(arr) = cw["timeline"].as_array_mut() {
            arr.insert(0, new_timeline_event);
        } else {
            cw["timeline"] = serde_json::json!([new_timeline_event]);
        }

        coworking_str = cw.to_string();
        let _ = conn.execute(
            "UPDATE projects SET coworking_data = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![coworking_str, pid],
        );

        return Ok(serde_json::json!({
            "success": true,
            "hash": short_hash,
            "message": message,
            "is_native_git": false,
            "coworking_data": cw
        }));
    }

    Ok(serde_json::json!({ "success": true, "is_native_git": false }))
}

#[tauri::command]
pub fn git_push_cmd(
    repo_path: Option<String>,
    project_id: Option<i64>,
    remote_url: Option<String>,
    branch: Option<String>,
    author: Option<String>,
    db: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let b = branch.unwrap_or_else(|| "main".to_string());
    let author_name = author.unwrap_or_else(|| "NEXUS User".to_string());
    let has_git_cli = std::process::Command::new("git").arg("--version").output().is_ok();

    if let Some(ref path_str) = repo_path {
        let path = Path::new(path_str);
        if has_git_cli && path.exists() && path.join(".git").exists() {
            let push_res = std::process::Command::new("git")
                .current_dir(path)
                .args(&["push", "origin", &b])
                .output();

            if let Ok(out) = push_res {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                return Ok(serde_json::json!({
                    "success": out.status.success(),
                    "output": if stdout.is_empty() { stderr } else { stdout },
                    "is_native_git": true
                }));
            }
        }
    }

    // In-app Virtual Git Push
    if let Some(pid) = project_id {
        let conn = db.conn.lock().unwrap();
        let mut coworking_str: String = conn
            .query_row("SELECT coworking_data FROM projects WHERE id = ?1", params![pid], |r| r.get(0))
            .unwrap_or_else(|_| "{}".to_string());

        let mut cw: serde_json::Value = serde_json::from_str(&coworking_str).unwrap_or(serde_json::json!({}));
        let target_remote = remote_url.unwrap_or_else(|| "origin/main".to_string());

        let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis().to_string();
        let new_timeline_event = serde_json::json!({
            "id": format!("t-push-{}", ts),
            "user": author_name,
            "action": format!("Выполнил Push в ветку {} -> {}", b, target_remote),
            "time": "только что",
            "type": "push"
        });

        if let Some(arr) = cw["timeline"].as_array_mut() {
            arr.insert(0, new_timeline_event);
        } else {
            cw["timeline"] = serde_json::json!([new_timeline_event]);
        }

        // Add a system notification in DB
        let _ = conn.execute(
            r#"INSERT INTO notifications (title, message, notif_type)
               VALUES (?1, ?2, 'success')"#,
            params![
                "Git Push завершен",
                format!("Ветка '{}' успешно отправлена в репозиторий {}", b, target_remote)
            ],
        );

        coworking_str = cw.to_string();
        let _ = conn.execute(
            "UPDATE projects SET coworking_data = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![coworking_str, pid],
        );

        return Ok(serde_json::json!({
            "success": true,
            "message": format!("Changes pushed to {} ({})", target_remote, b),
            "is_native_git": false,
            "coworking_data": cw
        }));
    }

    Ok(serde_json::json!({ "success": true, "is_native_git": false }))
}

#[tauri::command]
pub async fn ping_dev_server_cmd(url: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1500))
        .build()
        .map_err(|e| e.to_string())?;

    match client.get(&url).send().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

// ---------------- TASKS ----------------

#[tauri::command]
pub fn get_tasks(project_id: Option<i64>, db: State<'_, DbState>) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().unwrap();
    let sql = match project_id {
        Some(_) => "SELECT id, title, description, priority, status, due_date, project_id, kanban_column, created_at, updated_at FROM tasks WHERE project_id = ?1 ORDER BY id DESC",
        None => "SELECT id, title, description, priority, status, due_date, project_id, kanban_column, created_at, updated_at FROM tasks ORDER BY id DESC",
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mut list = Vec::new();
    if let Some(pid) = project_id {
        let rows = stmt.query_map(params![pid], |row| map_task(row)).map_err(|e| e.to_string())?;
        for r in rows {
            list.push(r.map_err(|e| e.to_string())?);
        }
    } else {
        let rows = stmt.query_map([], |row| map_task(row)).map_err(|e| e.to_string())?;
        for r in rows {
            list.push(r.map_err(|e| e.to_string())?);
        }
    }
    Ok(list)
}

fn map_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        priority: row.get(3)?,
        status: row.get(4)?,
        due_date: row.get(5)?,
        project_id: row.get(6)?,
        kanban_column: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

#[derive(Deserialize)]
pub struct TaskPayload {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<String>,
    pub project_id: Option<i64>,
    pub kanban_column: Option<String>,
}

#[tauri::command]
pub fn create_task(payload: TaskPayload, db: State<'_, DbState>) -> Result<Task, String> {
    let conn = db.conn.lock().unwrap();
    let desc = payload.description.unwrap_or_default();
    let priority = payload.priority.unwrap_or_else(|| "Normal".to_string());
    let status = payload.status.unwrap_or_else(|| "To Do".to_string());
    let column = payload.kanban_column.unwrap_or_else(|| "To Do".to_string());

    conn.execute(
        "INSERT INTO tasks (title, description, priority, status, due_date, project_id, kanban_column) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![payload.title, desc, priority, status, payload.due_date, payload.project_id, column],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Task {
        id,
        title: payload.title,
        description: desc,
        priority,
        status,
        due_date: payload.due_date,
        project_id: payload.project_id,
        kanban_column: Some(column),
        created_at: "Just now".to_string(),
        updated_at: "Just now".to_string(),
    })
}

#[tauri::command]
pub fn update_task(id: i64, payload: TaskPayload, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let desc = payload.description.unwrap_or_default();
    let priority = payload.priority.unwrap_or_else(|| "Normal".to_string());
    let status = payload.status.unwrap_or_else(|| "To Do".to_string());
    let column = payload.kanban_column.unwrap_or_else(|| "To Do".to_string());

    conn.execute(
        "UPDATE tasks SET title = ?1, description = ?2, priority = ?3, status = ?4, due_date = ?5, project_id = ?6, kanban_column = ?7, updated_at = CURRENT_TIMESTAMP WHERE id = ?8",
        params![payload.title, desc, priority, status, payload.due_date, payload.project_id, column, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_task_column(id: i64, kanban_column: String, status: Option<String>, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let stat = status.unwrap_or_else(|| kanban_column.clone());
    conn.execute(
        "UPDATE tasks SET kanban_column = ?1, status = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![kanban_column, stat, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_task(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- NOTES ----------------

#[tauri::command]
pub fn get_notes(db: State<'_, DbState>) -> Result<Vec<Note>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, title, content, is_pinned, tags, created_at, updated_at FROM notes ORDER BY is_pinned DESC, updated_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let is_pin_int: i32 = row.get(3)?;
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                is_pinned: is_pin_int != 0,
                tags: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[derive(Deserialize)]
pub struct NotePayload {
    pub title: String,
    pub content: String,
    pub is_pinned: Option<bool>,
    pub tags: Option<String>,
}

#[tauri::command]
pub fn create_note(payload: NotePayload, db: State<'_, DbState>) -> Result<Note, String> {
    let conn = db.conn.lock().unwrap();
    let pinned = if payload.is_pinned.unwrap_or(false) { 1 } else { 0 };
    let tags = payload.tags.unwrap_or_default();

    conn.execute(
        "INSERT INTO notes (title, content, is_pinned, tags) VALUES (?1, ?2, ?3, ?4)",
        params![payload.title, payload.content, pinned, tags],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Note {
        id,
        title: payload.title,
        content: payload.content,
        is_pinned: pinned != 0,
        tags,
        created_at: "Just now".to_string(),
        updated_at: "Just now".to_string(),
    })
}

#[tauri::command]
pub fn update_note(id: i64, payload: NotePayload, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let pinned = if payload.is_pinned.unwrap_or(false) { 1 } else { 0 };
    let tags = payload.tags.unwrap_or_default();

    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, is_pinned = ?3, tags = ?4, updated_at = CURRENT_TIMESTAMP WHERE id = ?5",
        params![payload.title, payload.content, pinned, tags, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_note(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- LAUNCHER ----------------

#[tauri::command]
pub fn get_launcher_items(db: State<'_, DbState>) -> Result<Vec<LauncherItem>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, title, target_path, icon, item_type, is_favorite, sort_order FROM launcher_items ORDER BY sort_order ASC, id ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let fav: i32 = row.get(5)?;
            Ok(LauncherItem {
                id: row.get(0)?,
                title: row.get(1)?,
                target_path: row.get(2)?,
                icon: row.get(3)?,
                item_type: row.get(4)?,
                is_favorite: fav != 0,
                sort_order: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[derive(Deserialize)]
pub struct LauncherPayload {
    pub title: String,
    pub target_path: String,
    pub icon: Option<String>,
    pub item_type: Option<String>,
    pub is_favorite: Option<bool>,
    pub sort_order: Option<i32>,
}

#[tauri::command]
pub fn create_launcher_item(payload: LauncherPayload, db: State<'_, DbState>) -> Result<LauncherItem, String> {
    let conn = db.conn.lock().unwrap();
    let icon = payload.icon.unwrap_or_else(|| "AppWindow".to_string());
    let itype = payload.item_type.unwrap_or_else(|| "app".to_string());
    let fav = if payload.is_favorite.unwrap_or(true) { 1 } else { 0 };
    let order = payload.sort_order.unwrap_or(0);

    conn.execute(
        "INSERT INTO launcher_items (title, target_path, icon, item_type, is_favorite, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![payload.title, payload.target_path, icon, itype, fav, order],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(LauncherItem {
        id,
        title: payload.title,
        target_path: payload.target_path,
        icon,
        item_type: itype,
        is_favorite: fav != 0,
        sort_order: order,
    })
}

#[tauri::command]
pub fn update_launcher_item(id: i64, payload: LauncherPayload, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let icon = payload.icon.unwrap_or_else(|| "AppWindow".to_string());
    let itype = payload.item_type.unwrap_or_else(|| "app".to_string());
    let fav = if payload.is_favorite.unwrap_or(true) { 1 } else { 0 };
    let order = payload.sort_order.unwrap_or(0);

    conn.execute(
        "UPDATE launcher_items SET title = ?1, target_path = ?2, icon = ?3, item_type = ?4, is_favorite = ?5, sort_order = ?6 WHERE id = ?7",
        params![payload.title, payload.target_path, icon, itype, fav, order, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_launcher_item(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM launcher_items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn launch_target(target: String) -> Result<String, String> {
    if target.starts_with("http://") || target.starts_with("https://") {
        open::that(&target).map_err(|e| format!("Failed to open URL: {}", e))?;
        Ok(format!("Opened {}", target))
    } else {
        open::that(&target).map_err(|e| format!("Failed to launch target: {}", e))?;
        Ok(format!("Launched {}", target))
    }
}

// ---------------- SYSTEM STATS & OPS ----------------

#[tauri::command]
pub fn get_system_stats(monitor: State<'_, MonitorState>) -> Result<SystemStats, String> {
    Ok(monitor.get_stats())
}

#[tauri::command]
pub fn kill_process_cmd(pid: u32, monitor: State<'_, MonitorState>) -> Result<bool, String> {
    let sys = monitor.sys.lock().unwrap();
    let pid_sys = sysinfo::Pid::from_u32(pid);
    if let Some(process) = sys.process(pid_sys) {
        let killed = process.kill();
        Ok(killed)
    } else {
        Err(format!("Process with PID {} not found", pid))
    }
}

#[tauri::command]
pub fn run_system_command(cmd: String) -> Result<String, String> {
    match cmd.as_str() {
        "empty_recycle_bin" => {
            std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"])
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok("Recycle bin emptied successfully".to_string())
        }
        "open_taskmgr" => {
            std::process::Command::new("taskmgr.exe")
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok("Task Manager opened".to_string())
        }
        "open_settings" => {
            open::that("ms-settings:").map_err(|e| e.to_string())?;
            Ok("Windows Settings opened".to_string())
        }
        "lock_workstation" => {
            std::process::Command::new("rundll32.exe")
                .args(["user32.dll,LockWorkStation"])
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok("Workstation locked".to_string())
        }
        "terminal" => {
            if std::process::Command::new("wt.exe").spawn().is_err() {
                std::process::Command::new("cmd.exe").spawn().map_err(|e| e.to_string())?;
            }
            Ok("Terminal opened".to_string())
        }
        _ => Err(format!("Unknown command: {}", cmd)),
    }
}

// ---------------- MULTIMEDIA & BROWSER MUSIC ----------------

#[cfg(target_os = "windows")]
extern "system" {
    fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
}

#[tauri::command]
pub fn send_system_media_key(key: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let vk_code: u8 = match key.as_str() {
            "play_pause" => 0xB3, // VK_MEDIA_PLAY_PAUSE
            "next" => 0xB0,       // VK_MEDIA_NEXT_TRACK
            "prev" => 0xB1,       // VK_MEDIA_PREV_TRACK
            "stop" => 0xB2,       // VK_MEDIA_STOP
            "volume_up" => 0xAF,   // VK_VOLUME_UP
            "volume_down" => 0xAE, // VK_VOLUME_DOWN
            "volume_mute" => 0xAD, // VK_VOLUME_MUTE
            _ => return Err(format!("Unknown media key: {}", key)),
        };

        const KEYEVENTF_KEYUP: u32 = 0x0002;
        keybd_event(vk_code, 0, 0, 0);
        keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0);

        Ok(format!("Media key {} executed", key))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(format!("Media key {} simulated", key))
    }
}

#[tauri::command]
pub fn open_music_service(service: String) -> Result<String, String> {
    let url = match service.as_str() {
        "youtube" => "https://music.youtube.com",
        "spotify" => "https://open.spotify.com",
        "yandex" => "https://music.yandex.ru",
        "soundcloud" => "https://soundcloud.com",
        "vk" => "https://vk.com/audio",
        "lofigirl" => "https://www.youtube.com/watch?v=jfKfPfyJRdk",
        "nightwave" => "https://nightride.fm",
        custom if custom.starts_with("http://") || custom.starts_with("https://") => custom,
        _ => "https://music.youtube.com",
    };

    open::that(url).map_err(|e| e.to_string())?;
    Ok(format!("Opened {}", url))
}

// ---------------- DOWNLOADS ----------------

#[tauri::command]
pub fn get_downloads(db: State<'_, DbState>) -> Result<Vec<DownloadRecord>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, url, file_name, file_path, total_bytes, downloaded_bytes, speed_bytes_sec, status, category, error_message, created_at, finished_at FROM downloads ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(DownloadRecord {
                id: row.get(0)?,
                url: row.get(1)?,
                file_name: row.get(2)?,
                file_path: row.get(3)?,
                total_bytes: row.get(4)?,
                downloaded_bytes: row.get(5)?,
                speed_bytes_sec: row.get(6)?,
                status: row.get(7)?,
                category: row.get(8)?,
                error_message: row.get(9)?,
                created_at: row.get(10)?,
                finished_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub async fn start_download_cmd(
    url: String,
    custom_filename: Option<String>,
    custom_dir: Option<String>,
    app: AppHandle,
) -> Result<i64, String> {
    let db_state = app.state::<DbState>();
    let downloader = app.state::<DownloaderState>();

    // Determine filename
    let inferred_name = url
        .split('?')
        .next()
        .unwrap_or(&url)
        .split('/')
        .last()
        .unwrap_or("downloaded_file");

    let filename = if let Some(cf) = custom_filename {
        if cf.trim().is_empty() {
            inferred_name.to_string()
        } else {
            cf
        }
    } else {
        inferred_name.to_string()
    };

    let filename = if filename.is_empty() {
        "file.bin".to_string()
    } else {
        filename
    };

    // Determine download folder
    let target_dir = if let Some(cd) = custom_dir {
        PathBuf::from(cd)
    } else {
        dirs::download_dir().unwrap_or_else(|| PathBuf::from("."))
    };

    let _ = fs::create_dir_all(&target_dir);
    let target_path = target_dir.join(&filename);
    let category = categorize_file(&filename);

    let download_id = {
        let conn = db_state.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO downloads (url, file_name, file_path, status, category, total_bytes, downloaded_bytes, speed_bytes_sec) VALUES (?1, ?2, ?3, 'downloading', ?4, 0, 0, 0)",
            params![url, filename, target_path.to_string_lossy().to_string(), category],
        ).map_err(|e| e.to_string())?;
        conn.last_insert_rowid()
    };

    let cancel_flag = downloader.register(download_id);
    let app_clone = app.clone();
    let url_clone = url.clone();
    let path_clone = target_path.clone();

    tokio::spawn(async move {
        let client = reqwest::Client::new();
        match client.get(&url_clone).send().await {
            Ok(resp) => {
                let total_size = resp.content_length().unwrap_or(0) as i64;
                let db_st = app_clone.state::<DbState>();
                {
                    let conn = db_st.conn.lock().unwrap();
                    let _ = conn.execute(
                        "UPDATE downloads SET total_bytes = ?1 WHERE id = ?2",
                        params![total_size, download_id],
                    );
                }

                match tokio::fs::File::create(&path_clone).await {
                    Ok(mut file) => {
                        let mut stream = resp.bytes_stream();
                        let mut downloaded: i64 = 0;
                        let mut last_tick = Instant::now();
                        let mut last_bytes = 0i64;

                        while let Some(chunk_res) = stream.next().await {
                            if cancel_flag.load(Ordering::SeqCst) {
                                let _ = file.flush().await;
                                drop(file);
                                let _ = tokio::fs::remove_file(&path_clone).await;
                                let conn = db_st.conn.lock().unwrap();
                                let _ = conn.execute(
                                    "UPDATE downloads SET status = 'cancelled', speed_bytes_sec = 0 WHERE id = ?1",
                                    params![download_id],
                                );
                                return;
                            }

                            match chunk_res {
                                Ok(chunk) => {
                                    if let Err(e) = file.write_all(&chunk).await {
                                        let conn = db_st.conn.lock().unwrap();
                                        let _ = conn.execute(
                                            "UPDATE downloads SET status = 'error', error_message = ?1 WHERE id = ?2",
                                            params![e.to_string(), download_id],
                                        );
                                        return;
                                    }
                                    downloaded += chunk.len() as i64;

                                    if last_tick.elapsed().as_millis() >= 500 {
                                        let elapsed_sec = last_tick.elapsed().as_secs_f64().max(0.1);
                                        let delta = downloaded - last_bytes;
                                        let speed = (delta as f64 / elapsed_sec) as i64;
                                        last_bytes = downloaded;
                                        last_tick = Instant::now();

                                        let conn = db_st.conn.lock().unwrap();
                                        let _ = conn.execute(
                                            "UPDATE downloads SET downloaded_bytes = ?1, speed_bytes_sec = ?2 WHERE id = ?3",
                                            params![downloaded, speed, download_id],
                                        );
                                    }
                                }
                                Err(e) => {
                                    let conn = db_st.conn.lock().unwrap();
                                    let _ = conn.execute(
                                        "UPDATE downloads SET status = 'error', error_message = ?1 WHERE id = ?2",
                                        params![e.to_string(), download_id],
                                    );
                                    return;
                                }
                            }
                        }

                        let _ = file.flush().await;
                        let conn = db_st.conn.lock().unwrap();
                        let _ = conn.execute(
                            "UPDATE downloads SET status = 'completed', downloaded_bytes = ?1, speed_bytes_sec = 0, finished_at = CURRENT_TIMESTAMP WHERE id = ?2",
                            params![downloaded, download_id],
                        );

                        // Add in-app notification
                        let _ = conn.execute(
                            "INSERT INTO notifications (title, message, notif_type) VALUES (?1, ?2, 'success')",
                            params!["Download Completed", format!("Finished downloading {}", filename)],
                        );
                    }
                    Err(e) => {
                        let conn = db_st.conn.lock().unwrap();
                        let _ = conn.execute(
                            "UPDATE downloads SET status = 'error', error_message = ?1 WHERE id = ?2",
                            params![e.to_string(), download_id],
                        );
                    }
                }
            }
            Err(e) => {
                let db_st = app_clone.state::<DbState>();
                let conn = db_st.conn.lock().unwrap();
                let _ = conn.execute(
                    "UPDATE downloads SET status = 'error', error_message = ?1 WHERE id = ?2",
                    params![e.to_string(), download_id],
                );
            }
        }
    });

    Ok(download_id)
}

#[tauri::command]
pub fn cancel_download_cmd(id: i64, downloader: State<'_, DownloaderState>, db: State<'_, DbState>) -> Result<(), String> {
    downloader.cancel(id);
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "UPDATE downloads SET status = 'cancelled', speed_bytes_sec = 0 WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_download_file(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let path: String = conn
        .query_row("SELECT file_path FROM downloads WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    open::that(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_download_folder(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let path_str: String = conn
        .query_row("SELECT file_path FROM downloads WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let p = Path::new(&path_str);
    if let Some(parent) = p.parent() {
        open::that(parent).map_err(|e| e.to_string())?;
    } else {
        open::that(&path_str).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_download(id: i64, delete_file: bool, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    if delete_file {
        if let Ok(path) = conn.query_row("SELECT file_path FROM downloads WHERE id = ?1", params![id], |r| r.get::<_, String>(0)) {
            let _ = fs::remove_file(path);
        }
    }
    conn.execute("DELETE FROM downloads WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- CLIPBOARD ----------------

#[tauri::command]
pub fn sync_clipboard_cmd(clipboard: State<'_, ClipboardState>, db: State<'_, DbState>) -> Result<Option<ClipboardRecord>, String> {
    if let Ok(text) = clipboard.get_current_text() {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Ok(None);
        }

        let mut last = clipboard.last_content.lock().unwrap();
        if *last == trimmed {
            return Ok(None);
        }
        *last = trimmed.to_string();

        let itype = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            "link"
        } else {
            "text"
        };

        let conn = db.conn.lock().unwrap();
        // Check if item already exists at the top
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM clipboard_items WHERE content = ?1",
                params![trimmed],
                |r| Ok(r.get::<_, i64>(0)? > 0),
            )
            .unwrap_or(false);

        if !exists {
            conn.execute(
                "INSERT INTO clipboard_items (content_type, content) VALUES (?1, ?2)",
                params![itype, trimmed],
            ).map_err(|e| e.to_string())?;

            let id = conn.last_insert_rowid();

            // Prune history to limit (keep max 100)
            let _ = conn.execute(
                "DELETE FROM clipboard_items WHERE is_pinned = 0 AND id NOT IN (SELECT id FROM clipboard_items ORDER BY id DESC LIMIT 100)",
                [],
            );

            return Ok(Some(ClipboardRecord {
                id,
                content_type: itype.to_string(),
                content: trimmed.to_string(),
                is_pinned: false,
                is_favorite: false,
                created_at: "Just now".to_string(),
            }));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn get_clipboard_history(db: State<'_, DbState>) -> Result<Vec<ClipboardRecord>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, content_type, content, is_pinned, is_favorite, created_at FROM clipboard_items ORDER BY is_pinned DESC, id DESC LIMIT 100")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let pin: i32 = row.get(3)?;
            let fav: i32 = row.get(4)?;
            Ok(ClipboardRecord {
                id: row.get(0)?,
                content_type: row.get(1)?,
                content: row.get(2)?,
                is_pinned: pin != 0,
                is_favorite: fav != 0,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn set_clipboard_text_cmd(text: String, clipboard: State<'_, ClipboardState>) -> Result<(), String> {
    clipboard.set_text(&text)
}

#[tauri::command]
pub fn toggle_clipboard_pin(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "UPDATE clipboard_items SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_clipboard_favorite(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "UPDATE clipboard_items SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_clipboard_item(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM clipboard_items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clear_clipboard_history(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM clipboard_items WHERE is_pinned = 0", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- CALENDAR ----------------

#[tauri::command]
pub fn get_calendar_events(db: State<'_, DbState>) -> Result<Vec<CalendarEvent>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, title, description, start_time, end_time, category, project_id, is_recurring, recurrence_rule, created_at FROM calendar_events ORDER BY start_time ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let rec: i32 = row.get(7)?;
            Ok(CalendarEvent {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                start_time: row.get(3)?,
                end_time: row.get(4)?,
                category: row.get(5)?,
                project_id: row.get(6)?,
                is_recurring: rec != 0,
                recurrence_rule: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[derive(Deserialize)]
pub struct CalendarEventPayload {
    pub title: String,
    pub description: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub category: Option<String>,
    pub project_id: Option<i64>,
    pub is_recurring: Option<bool>,
    pub recurrence_rule: Option<String>,
}

#[tauri::command]
pub fn create_calendar_event(payload: CalendarEventPayload, db: State<'_, DbState>) -> Result<CalendarEvent, String> {
    let conn = db.conn.lock().unwrap();
    let desc = payload.description.unwrap_or_default();
    let cat = payload.category.unwrap_or_else(|| "Work".to_string());
    let rec = if payload.is_recurring.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        "INSERT INTO calendar_events (title, description, start_time, end_time, category, project_id, is_recurring, recurrence_rule) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![payload.title, desc, payload.start_time, payload.end_time, cat, payload.project_id, rec, payload.recurrence_rule],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(CalendarEvent {
        id,
        title: payload.title,
        description: desc,
        start_time: payload.start_time,
        end_time: payload.end_time,
        category: cat,
        project_id: payload.project_id,
        is_recurring: rec != 0,
        recurrence_rule: payload.recurrence_rule,
        created_at: "Just now".to_string(),
    })
}

#[tauri::command]
pub fn update_calendar_event(id: i64, payload: CalendarEventPayload, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let desc = payload.description.unwrap_or_default();
    let cat = payload.category.unwrap_or_else(|| "Work".to_string());
    let rec = if payload.is_recurring.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        "UPDATE calendar_events SET title = ?1, description = ?2, start_time = ?3, end_time = ?4, category = ?5, project_id = ?6, is_recurring = ?7, recurrence_rule = ?8 WHERE id = ?9",
        params![payload.title, desc, payload.start_time, payload.end_time, cat, payload.project_id, rec, payload.recurrence_rule, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_calendar_event(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM calendar_events WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- AUTOMATION ----------------

#[tauri::command]
pub fn get_automation_rules(db: State<'_, DbState>) -> Result<Vec<AutomationRule>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, title, trigger_type, trigger_val, action_type, action_payload, is_active, last_run, created_at FROM automation_rules ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let active: i32 = row.get(6)?;
            Ok(AutomationRule {
                id: row.get(0)?,
                title: row.get(1)?,
                trigger_type: row.get(2)?,
                trigger_val: row.get(3)?,
                action_type: row.get(4)?,
                action_payload: row.get(5)?,
                is_active: active != 0,
                last_run: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[derive(Deserialize)]
pub struct AutomationPayload {
    pub title: String,
    pub trigger_type: String,
    pub trigger_val: String,
    pub action_type: String,
    pub action_payload: String,
    pub is_active: Option<bool>,
}

#[tauri::command]
pub fn create_automation_rule(payload: AutomationPayload, db: State<'_, DbState>) -> Result<AutomationRule, String> {
    let conn = db.conn.lock().unwrap();
    let active = if payload.is_active.unwrap_or(true) { 1 } else { 0 };

    conn.execute(
        "INSERT INTO automation_rules (title, trigger_type, trigger_val, action_type, action_payload, is_active) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![payload.title, payload.trigger_type, payload.trigger_val, payload.action_type, payload.action_payload, active],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(AutomationRule {
        id,
        title: payload.title,
        trigger_type: payload.trigger_type,
        trigger_val: payload.trigger_val,
        action_type: payload.action_type,
        action_payload: payload.action_payload,
        is_active: active != 0,
        last_run: None,
        created_at: "Just now".to_string(),
    })
}

#[tauri::command]
pub fn toggle_automation_rule(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "UPDATE automation_rules SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_automation_rule(id: i64, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM automation_rules WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn execute_automation_rule_now(id: i64, db: State<'_, DbState>) -> Result<String, String> {
    let conn = db.conn.lock().unwrap();
    let (action_type, action_payload): (String, String) = conn
        .query_row(
            "SELECT action_type, action_payload FROM automation_rules WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let result = match action_type.as_str() {
        "launch_app" | "open_url" => {
            open::that(&action_payload).map_err(|e| e.to_string())?;
            format!("Launched {}", action_payload)
        }
        "notification" => {
            conn.execute(
                "INSERT INTO notifications (title, message, notif_type) VALUES (?1, ?2, 'reminder')",
                params!["Automated Reminder", action_payload],
            ).map_err(|e| e.to_string())?;
            format!("Notification posted: {}", action_payload)
        }
        "empty_trash" => {
            std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"])
                .spawn()
                .map_err(|e| e.to_string())?;
            "Trash emptied".to_string()
        }
        _ => "Action completed".to_string(),
    };

    let _ = conn.execute(
        "UPDATE automation_rules SET last_run = CURRENT_TIMESTAMP WHERE id = ?1",
        params![id],
    );

    Ok(result)
}

// ---------------- WEATHER & TOOLS ----------------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WeatherData {
    pub temperature: f64,
    pub weather_code: i32,
    pub condition_text: String,
    pub wind_speed: f64,
    pub humidity: i32,
    pub location_name: String,
    pub updated_at: String,
    pub is_cached: bool,
}

#[tauri::command]
pub async fn fetch_weather(city: Option<String>, db: State<'_, DbState>) -> Result<WeatherData, String> {
    let loc = city.unwrap_or_else(|| "Local Station".to_string());

    // Public weather endpoint (Open-Meteo default coordinates: 55.75, 37.61)
    let url = "https://api.open-meteo.com/v1/forecast?latitude=55.75&longitude=37.61&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    match client.get(url).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(curr) = json.get("current") {
                    let temp = curr.get("temperature_2m").and_then(|v| v.as_f64()).unwrap_or(18.5);
                    let code = curr.get("weather_code").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    let wind = curr.get("wind_speed_10m").and_then(|v| v.as_f64()).unwrap_or(3.2);
                    let hum = curr.get("relative_humidity_2m").and_then(|v| v.as_i64()).unwrap_or(65) as i32;

                    let condition = match code {
                        0 => "Clear Sky",
                        1..=3 => "Partly Cloudy",
                        45 | 48 => "Foggy",
                        51..=55 => "Drizzle",
                        61..=65 => "Rain",
                        71..=77 => "Snow",
                        80..=82 => "Showers",
                        95..=99 => "Thunderstorm",
                        _ => "Clear",
                    };

                    let data = WeatherData {
                        temperature: temp,
                        weather_code: code,
                        condition_text: condition.to_string(),
                        wind_speed: wind,
                        humidity: hum,
                        location_name: loc,
                        updated_at: chrono::Local::now().format("%H:%M").to_string(),
                        is_cached: false,
                    };

                    // Cache to settings table
                    let serialized = serde_json::to_string(&data).unwrap_or_default();
                    let conn = db.conn.lock().unwrap();
                    let _ = conn.execute(
                        "INSERT OR REPLACE INTO settings (key, value) VALUES ('weather_cache', ?1)",
                        params![serialized],
                    );

                    return Ok(data);
                }
            }
        }
        Err(_) => {}
    }

    // Fallback to cache if offline
    let conn = db.conn.lock().unwrap();
    if let Ok(cached_str) = conn.query_row(
        "SELECT value FROM settings WHERE key = 'weather_cache'",
        [],
        |r| r.get::<_, String>(0),
    ) {
        if let Ok(mut cached) = serde_json::from_str::<WeatherData>(&cached_str) {
            cached.is_cached = true;
            return Ok(cached);
        }
    }

    // Default offline fallback
    Ok(WeatherData {
        temperature: 20.0,
        weather_code: 0,
        condition_text: "Offline (Saved State)".to_string(),
        wind_speed: 2.0,
        humidity: 50,
        location_name: "Local Station".to_string(),
        updated_at: "Offline".to_string(),
        is_cached: true,
    })
}

#[derive(Serialize, Deserialize)]
pub struct PingResult {
    pub url: String,
    pub status_code: u16,
    pub latency_ms: u64,
    pub is_online: bool,
    pub error_msg: Option<String>,
}

#[tauri::command]
pub async fn check_website_ping(url: String) -> Result<PingResult, String> {
    let target = if !url.starts_with("http://") && !url.starts_with("https://") {
        format!("https://{}", url)
    } else {
        url.clone()
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    let start = Instant::now();
    match client.get(&target).send().await {
        Ok(resp) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            let status = resp.status().as_u16();
            Ok(PingResult {
                url: target,
                status_code: status,
                latency_ms,
                is_online: true,
                error_msg: None,
            })
        }
        Err(e) => {
            let latency_ms = start.elapsed().as_millis() as u64;
            Ok(PingResult {
                url: target,
                status_code: 0,
                latency_ms,
                is_online: false,
                error_msg: Some(e.to_string()),
            })
        }
    }
}

// ---------------- NOTIFICATIONS ----------------

#[tauri::command]
pub fn get_notifications(db: State<'_, DbState>) -> Result<Vec<AppNotification>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, title, message, notif_type, is_read, created_at FROM notifications ORDER BY id DESC LIMIT 50")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let r: i32 = row.get(4)?;
            Ok(AppNotification {
                id: row.get(0)?,
                title: row.get(1)?,
                message: row.get(2)?,
                notif_type: row.get(3)?,
                is_read: r != 0,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn mark_all_notifications_read(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("UPDATE notifications SET is_read = 1", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clear_all_notifications(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute("DELETE FROM notifications", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- SETTINGS & BACKUP ----------------

#[tauri::command]
pub fn get_app_settings(db: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;

    let mut map = serde_json::Map::new();
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    for r in rows {
        if let Ok((k, v)) = r {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&v) {
                map.insert(k, parsed);
            } else {
                map.insert(k, serde_json::Value::String(v));
            }
        }
    }

    Ok(serde_json::Value::Object(map))
}

#[tauri::command]
pub fn save_app_setting(key: String, value: serde_json::Value, db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let v_str = if value.is_string() {
        value.as_str().unwrap().to_string()
    } else {
        serde_json::to_string(&value).unwrap_or_default()
    };

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, v_str],
    ).map_err(|e| e.to_string())?;

    if key == "autostart" {
        let enabled = if let Some(b) = value.as_bool() {
            b
        } else if let Some(s) = value.as_str() {
            s == "true"
        } else {
            true
        };
        let _ = set_autostart_cmd(enabled);
    }

    Ok(())
}

#[tauri::command]
pub fn set_autostart_cmd(enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if enabled {
            let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_path = current_exe.to_string_lossy().to_string();
            let reg_value = format!("\"{}\" --autostart", exe_path);
            let status = Command::new("reg")
                .args(&[
                    "add",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "NEXUS",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &reg_value,
                    "/f",
                ])
                .status()
                .map_err(|e| e.to_string())?;

            if status.success() {
                Ok(true)
            } else {
                Err("Failed to configure autostart in Windows registry".to_string())
            }
        } else {
            let _ = Command::new("reg")
                .args(&[
                    "delete",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "NEXUS",
                    "/f",
                ])
                .status();

            Ok(false)
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(enabled)
    }
}

#[tauri::command]
pub fn is_autostart_enabled_cmd() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args(&[
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "NEXUS",
            ])
            .output();

        match output {
            Ok(out) => Ok(out.status.success()),
            Err(_) => Ok(false),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn export_backup_json(db: State<'_, DbState>) -> Result<String, String> {
    let projects = get_projects(db.clone())?;
    let tasks = get_tasks(None, db.clone())?;
    let notes = get_notes(db.clone())?;
    let launchers = get_launcher_items(db.clone())?;
    let automations = get_automation_rules(db.clone())?;
    let calendar = get_calendar_events(db.clone())?;
    let settings = get_app_settings(db.clone())?;

    let backup = serde_json::json!({
        "version": "1.0.0",
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "projects": projects,
        "tasks": tasks,
        "notes": notes,
        "launchers": launchers,
        "automations": automations,
        "calendar": calendar,
        "settings": settings,
    });

    serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_backup_json(json_content: String, db: State<'_, DbState>) -> Result<String, String> {
    let parsed: serde_json::Value = serde_json::from_str(&json_content).map_err(|e| e.to_string())?;
    let conn = db.conn.lock().unwrap();

    // Import notes if present
    if let Some(notes) = parsed.get("notes").and_then(|v| v.as_array()) {
        for n in notes {
            let title = n.get("title").and_then(|v| v.as_str()).unwrap_or("Restored Note");
            let content = n.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let tags = n.get("tags").and_then(|v| v.as_str()).unwrap_or("");
            let _ = conn.execute(
                "INSERT INTO notes (title, content, tags) VALUES (?1, ?2, ?3)",
                params![title, content, tags],
            );
        }
    }

    // Import tasks if present
    if let Some(tasks) = parsed.get("tasks").and_then(|v| v.as_array()) {
        for t in tasks {
            let title = t.get("title").and_then(|v| v.as_str()).unwrap_or("Restored Task");
            let desc = t.get("description").and_then(|v| v.as_str()).unwrap_or("");
            let priority = t.get("priority").and_then(|v| v.as_str()).unwrap_or("Normal");
            let status = t.get("status").and_then(|v| v.as_str()).unwrap_or("To Do");
            let _ = conn.execute(
                "INSERT INTO tasks (title, description, priority, status) VALUES (?1, ?2, ?3, ?4)",
                params![title, desc, priority, status],
            );
        }
    }

    Ok("Backup restored successfully".to_string())
}

#[tauri::command]
pub fn get_db_path(db: State<'_, DbState>) -> Result<String, String> {
    Ok(db.db_path.to_string_lossy().to_string())
}

// ---------------- GITHUB INTEGRATION ----------------

fn github_client(token: Option<&str>) -> Result<reqwest::Client, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        reqwest::header::HeaderValue::from_static("NEXUS-Desktop-Agent"),
    );
    headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("application/vnd.github.v3+json"),
    );
    if let Some(t) = token {
        let trimmed = t.trim();
        if !trimmed.is_empty() {
            let auth_val = format!("Bearer {}", trimmed);
            if let Ok(hv) = reqwest::header::HeaderValue::from_str(&auth_val) {
                headers.insert(reqwest::header::AUTHORIZATION, hv);
            }
        }
    }

    reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_login_cmd(token: String, db: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let clean_token = token.trim();
    if clean_token.is_empty() {
        return Err("Введите токен доступа GitHub".to_string());
    }

    let client = github_client(Some(clean_token))?;
    let resp = client
        .get("https://api.github.com/user")
        .send()
        .await
        .map_err(|e| format!("Сетевая ошибка при обращении к GitHub: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Ошибка авторизации (HTTP {}). Проверьте правильность токена и наличие разрешений 'repo'.",
            resp.status()
        ));
    }

    let user_val: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    // Store in settings table
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('github_token', ?1)",
        params![clean_token],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('github_user', ?1)",
        params![user_val.to_string()],
    ).map_err(|e| e.to_string())?;

    let login_str = user_val["login"].as_str().unwrap_or("user");
    let _ = conn.execute(
        "INSERT INTO notifications (title, message, notif_type) VALUES (?1, ?2, 'success')",
        params![
            "GitHub подключен",
            format!("Вы успешно вошли как @{}", login_str)
        ],
    );

    Ok(user_val)
}

#[tauri::command]
pub fn github_get_user_cmd(db: State<'_, DbState>) -> Result<Option<serde_json::Value>, String> {
    let conn = db.conn.lock().unwrap();
    let user_str: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = 'github_user'", [], |r| r.get(0))
        .ok();

    if let Some(s) = user_str {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
            return Ok(Some(v));
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn github_logout_cmd(db: State<'_, DbState>) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let _ = conn.execute("DELETE FROM settings WHERE key IN ('github_token', 'github_user')", []);
    let _ = conn.execute(
        "INSERT INTO notifications (title, message, notif_type) VALUES ('GitHub отключен', 'Вы вышли из аккаунта GitHub', 'info')",
        [],
    );
    Ok(())
}

#[tauri::command]
pub async fn github_list_repos_cmd(db: State<'_, DbState>) -> Result<Vec<serde_json::Value>, String> {
    let token = {
        let conn = db.conn.lock().unwrap();
        conn.query_row("SELECT value FROM settings WHERE key = 'github_token'", [], |r| r.get::<_, String>(0)).ok()
    };

    let client = github_client(token.as_deref())?;
    let url = if token.is_some() {
        "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member"
    } else {
        return Err("GitHub аккаунт не подключен. Введите персональный токен.".to_string());
    };

    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Ошибка получения репозиториев (HTTP {})", resp.status()));
    }

    let repos: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(repos)
}

#[tauri::command]
pub async fn github_search_repos_cmd(query: String, db: State<'_, DbState>) -> Result<Vec<serde_json::Value>, String> {
    let (token, user_login) = {
        let conn = db.conn.lock().unwrap();
        let tok = conn.query_row("SELECT value FROM settings WHERE key = 'github_token'", [], |r| r.get::<_, String>(0)).ok();
        let u: Option<String> = conn.query_row("SELECT value FROM settings WHERE key = 'github_user'", [], |r| r.get(0)).ok();
        let login = u.and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
            .and_then(|v| v["login"].as_str().map(|s| s.to_string()));
        (tok, login)
    };

    let client = github_client(token.as_deref())?;
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }

    // Direct owner/repo lookup if slash present
    if q.contains('/') {
        let clean = q.trim_start_matches("https://github.com/").trim_end_matches(".git").trim();
        let resp = client.get(&format!("https://api.github.com/repos/{}", clean)).send().await.map_err(|e| e.to_string())?;
        if resp.status().is_success() {
            let repo: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            return Ok(vec![repo]);
        }
    } else if let Some(ref login) = user_login {
        // Try direct lookup under current user: owner/repo
        let user_repo_url = format!("https://api.github.com/repos/{}/{}", login, q);
        if let Ok(resp) = client.get(&user_repo_url).send().await {
            if resp.status().is_success() {
                if let Ok(repo) = resp.json::<serde_json::Value>().await {
                    return Ok(vec![repo]);
                }
            }
        }
    }

    let url = format!("https://api.github.com/search/repositories?q={}+fork:true&sort=stars&per_page=20", q);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Поиск не удался (HTTP {})", resp.status()));
    }

    let search_res: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let items = search_res["items"].as_array().cloned().unwrap_or_default();
    Ok(items)
}

#[tauri::command]
pub async fn github_import_repo_cmd(
    owner: String,
    repo: String,
    branch: Option<String>,
    db: State<'_, DbState>,
) -> Result<Project, String> {
    let token = {
        let conn = db.conn.lock().unwrap();
        conn.query_row("SELECT value FROM settings WHERE key = 'github_token'", [], |r| r.get::<_, String>(0)).ok()
    };

    let client = github_client(token.as_deref())?;

    // 1. Fetch Repo info
    let repo_url = format!("https://api.github.com/repos/{}/{}", owner, repo);
    let repo_resp = client.get(&repo_url).send().await.map_err(|e| e.to_string())?;
    if !repo_resp.status().is_success() {
        return Err(format!("Не удалось получить репозиторий {}/{} (HTTP {})", owner, repo, repo_resp.status()));
    }
    let repo_info: serde_json::Value = repo_resp.json().await.map_err(|e| e.to_string())?;

    let default_branch = repo_info["default_branch"].as_str().unwrap_or("main").to_string();
    let target_branch = branch.unwrap_or(default_branch);
    let title = repo_info["name"].as_str().unwrap_or(&repo).to_string();
    let desc = repo_info["description"].as_str().unwrap_or("").to_string();
    let clone_url = repo_info["clone_url"].as_str().unwrap_or(&format!("https://github.com/{}/{}.git", owner, repo)).to_string();
    let lang = repo_info["language"].as_str().unwrap_or("Other");

    let cover_color = match lang {
        "TypeScript" => "#3b82f6",
        "JavaScript" => "#f59e0b",
        "Rust" => "#ea580c",
        "Python" => "#10b981",
        "HTML" | "CSS" => "#ec4899",
        "Go" => "#06b6d4",
        "C++" | "C" => "#6366f1",
        _ => "#8b5cf6",
    };

    // 2. Fetch File Tree
    let tree_url = format!("https://api.github.com/repos/{}/{}/git/trees/{}?recursive=1", owner, repo, target_branch);
    let mut downloaded_files = Vec::new();

    if let Ok(tree_resp) = client.get(&tree_url).send().await {
        if tree_resp.status().is_success() {
            if let Ok(tree_json) = tree_resp.json::<serde_json::Value>().await {
                if let Some(tree_arr) = tree_json["tree"].as_array() {
                    let mut file_paths_to_fetch = Vec::new();
                    for item in tree_arr {
                        if item["type"].as_str() == Some("blob") {
                            if let Some(p) = item["path"].as_str() {
                                if !p.starts_with(".git")
                                    && !p.starts_with("node_modules")
                                    && !p.starts_with("target")
                                    && !p.ends_with(".png")
                                    && !p.ends_with(".jpg")
                                    && !p.ends_with(".ico")
                                    && !p.ends_with(".lock")
                                    && !p.ends_with(".exe")
                                {
                                    file_paths_to_fetch.push(p.to_string());
                                }
                            }
                        }
                    }

                    file_paths_to_fetch.sort_by(|a, b| {
                        let score = |s: &str| {
                            if s.to_lowercase().contains("readme") { 0 }
                            else if s.to_lowercase().contains("index") { 1 }
                            else if s.to_lowercase().contains("package") { 2 }
                            else if s.to_lowercase().contains("app") { 3 }
                            else if s.to_lowercase().contains("main") { 4 }
                            else { 10 }
                        };
                        score(a).cmp(&score(b))
                    });

                    for (idx, path_str) in file_paths_to_fetch.into_iter().take(15).enumerate() {
                        let contents_url = format!("https://api.github.com/repos/{}/{}/contents/{}?ref={}", owner, repo, path_str, target_branch);
                        let file_content = match client.get(&contents_url)
                            .header(reqwest::header::ACCEPT, "application/vnd.github.raw+json")
                            .send()
                            .await
                        {
                            Ok(res) if res.status().is_success() => res.text().await.unwrap_or_default(),
                            _ => {
                                let raw_url = format!("https://raw.githubusercontent.com/{}/{}/{}/{}", owner, repo, target_branch, path_str);
                                match client.get(&raw_url).send().await {
                                    Ok(res2) if res2.status().is_success() => res2.text().await.unwrap_or_default(),
                                    _ => String::new(),
                                }
                            }
                        };

                        let file_name = path_str.split('/').last().unwrap_or(&path_str).to_string();
                        let file_lang = if file_name.ends_with(".html") { "html" }
                            else if file_name.ends_with(".css") { "css" }
                            else if file_name.ends_with(".js") || file_name.ends_with(".jsx") { "javascript" }
                            else if file_name.ends_with(".ts") || file_name.ends_with(".tsx") { "typescript" }
                            else if file_name.ends_with(".rs") { "rust" }
                            else if file_name.ends_with(".py") { "python" }
                            else if file_name.ends_with(".json") { "json" }
                            else if file_name.ends_with(".md") { "markdown" }
                            else { "text" };

                        downloaded_files.push(serde_json::json!({
                            "id": format!("f-{}", idx + 1),
                            "name": file_name,
                            "path": path_str,
                            "language": file_lang,
                            "content": file_content
                        }));
                    }
                }
            }
        }
    }

    if downloaded_files.is_empty() {
        downloaded_files.push(serde_json::json!({
            "id": "f-readme",
            "name": "README.md",
            "path": "README.md",
            "language": "markdown",
            "content": format!("# {}\n\n{}", title, desc)
        }));
    }

    // 3. Fetch Commits
    let commits_url = format!("https://api.github.com/repos/{}/{}/commits?per_page=10", owner, repo);
    let mut mapped_commits = Vec::new();
    if let Ok(c_resp) = client.get(&commits_url).send().await {
        if c_resp.status().is_success() {
            if let Ok(c_arr) = c_resp.json::<Vec<serde_json::Value>>().await {
                for c in c_arr {
                    let sha = c["sha"].as_str().unwrap_or("0000000");
                    let short_sha = if sha.len() >= 7 { &sha[..7] } else { sha };
                    let msg = c["commit"]["message"].as_str().unwrap_or("Commit").lines().next().unwrap_or("Commit");
                    let author_name = c["commit"]["author"]["name"].as_str().unwrap_or(&owner);
                    let date_str = c["commit"]["author"]["date"].as_str().unwrap_or("");

                    mapped_commits.push(serde_json::json!({
                        "hash": short_sha,
                        "message": msg,
                        "author": author_name,
                        "branch": target_branch,
                        "time": date_str
                    }));
                }
            }
        }
    }

    // 4. Fetch Contributors / Team
    let contrib_url = format!("https://api.github.com/repos/{}/{}/contributors?per_page=6", owner, repo);
    let mut mapped_members = Vec::new();
    if let Ok(m_resp) = client.get(&contrib_url).send().await {
        if m_resp.status().is_success() {
            if let Ok(m_arr) = m_resp.json::<Vec<serde_json::Value>>().await {
                let avatars = ["🚀", "🎨", "⚡", "🛡️", "💻", "🔥"];
                for (idx, m) in m_arr.into_iter().enumerate() {
                    let login = m["login"].as_str().unwrap_or("Contributor");
                    mapped_members.push(serde_json::json!({
                        "id": format!("m-{}", idx + 1),
                        "name": login,
                        "role": if idx == 0 { "Repository Owner" } else { "Contributor" },
                        "avatar": avatars[idx % avatars.len()],
                        "status": "active"
                    }));
                }
            }
        }
    }

    if mapped_members.is_empty() {
        mapped_members.push(serde_json::json!({
            "id": "m-1",
            "name": owner,
            "role": "Owner / Author",
            "avatar": "🚀",
            "status": "active"
        }));
    }

    let coworking_data = serde_json::json!({
        "members": mapped_members,
        "messages": [
            {
                "id": "msg-import",
                "author": "NEXUS Agent",
                "avatar": "🤖",
                "time": chrono::Local::now().format("%H:%M").to_string(),
                "text": format!("Репозиторий {}/{} успешно импортирован с GitHub! Ветка: {}", owner, repo, target_branch)
            }
        ],
        "timeline": [
            {
                "id": format!("tl-{}", chrono::Local::now().timestamp_millis()),
                "user": "NEXUS",
                "action": format!("Импортирован репозиторий с GitHub ({}/{})", owner, repo),
                "time": "только что",
                "type": "push"
            }
        ],
        "commits": mapped_commits,
        "activeBranch": target_branch,
        "branches": [target_branch.clone(), "main"],
        "scratchpad": format!("### Репозиторий: {}/{}\n- Клонирован с GitHub\n- Основная ветка: {}\n- Загружено файлов: {}", owner, repo, target_branch, downloaded_files.len())
    });

    let code_files_str = serde_json::to_string(&downloaded_files).unwrap_or_else(|_| "[]".to_string());
    let coworking_str = coworking_data.to_string();
    let repo_path = format!("./projects/{}", repo);

    let links_str = serde_json::json!([
        { "title": "GitHub Repository", "url": format!("https://github.com/{}/{}", owner, repo) },
        { "title": "Clone URL", "url": clone_url }
    ]).to_string();

    let conn = db.conn.lock().unwrap();
    conn.execute(
        r#"INSERT INTO projects (title, description, cover_color, status, progress, deadline, notes, links, repo_path, git_remote, code_files, coworking_data)
           VALUES (?1, ?2, ?3, 'In Progress', 40, NULL, ?4, ?5, ?6, ?7, ?8, ?9)"#,
        params![
            title,
            desc,
            cover_color,
            format!("# {}\n\n{}", title, desc),
            links_str,
            repo_path,
            clone_url,
            code_files_str,
            coworking_str
        ],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    let _ = conn.execute(
        "INSERT INTO notifications (title, message, notif_type) VALUES (?1, ?2, 'success')",
        params![
            "Репозиторий импортирован",
            format!("Проект '{}' успешно загружен из GitHub ({})", title, clone_url)
        ],
    );

    Ok(Project {
        id,
        title,
        description: desc,
        cover_color: cover_color.to_string(),
        status: "In Progress".to_string(),
        progress: 40,
        deadline: None,
        notes: Some(format!("# {}\n\n{}", repo, clone_url)),
        links: Some(links_str),
        repo_path: Some(repo_path),
        git_remote: Some(clone_url),
        code_files: Some(code_files_str),
        coworking_data: Some(coworking_str),
        created_at: "Just now".to_string(),
        updated_at: "Just now".to_string(),
    })
}

// -------------------------------------------------------------
// WINDOW CONTROLS (Obsidian-style custom titlebar)
// -------------------------------------------------------------
#[tauri::command]
pub fn window_minimize_cmd(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_toggle_maximize_cmd(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn window_close_cmd(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// -------------------------------------------------------------
// EMBEDDED PROJECT TERMINAL
// -------------------------------------------------------------
#[tauri::command]
pub fn run_project_terminal_cmd(
    dir_path: Option<String>,
    command: String,
) -> Result<serde_json::Value, String> {
    let start_time = std::time::Instant::now();
    let clean_cmd = command.trim();
    if clean_cmd.is_empty() {
        return Ok(serde_json::json!({
            "stdout": "",
            "stderr": "",
            "exit_code": 0,
            "duration_ms": 0
        }));
    }

    let mut proc = std::process::Command::new("powershell");
    proc.args(["-NoProfile", "-NonInteractive", "-Command", clean_cmd]);

    if let Some(ref d) = dir_path {
        let p = Path::new(d);
        if p.exists() {
            proc.current_dir(p);
        }
    }

    let output = proc.output().map_err(|e| format!("Ошибка терминала: {}", e))?;
    let duration = start_time.elapsed().as_millis() as u64;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let code = output.status.code().unwrap_or(if output.status.success() { 0 } else { 1 });

    Ok(serde_json::json!({
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": code,
        "duration_ms": duration
    }))
}

// -------------------------------------------------------------
// GIT DIFF COMMAND
// -------------------------------------------------------------
#[tauri::command]
pub fn git_diff_cmd(
    repo_path: Option<String>,
    file_path: Option<String>,
) -> Result<String, String> {
    let has_git = std::process::Command::new("git").arg("--version").output().is_ok();
    if let Some(ref p_str) = repo_path {
        let path = Path::new(p_str);
        if has_git && path.exists() && path.join(".git").exists() {
            let mut cmd = std::process::Command::new("git");
            cmd.current_dir(path).arg("diff");
            if let Some(ref f) = file_path {
                cmd.arg("--").arg(f);
            }
            if let Ok(out) = cmd.output() {
                let diff_text = String::from_utf8_lossy(&out.stdout).to_string();
                return Ok(diff_text);
            }
        }
    }
    Ok(String::new())
}

// -------------------------------------------------------------
// CHECKPOINTS (PROJECT SNAPSHOTS)
// -------------------------------------------------------------
#[tauri::command]
pub fn create_checkpoint_cmd(
    project_id: i64,
    name: String,
    description: Option<String>,
    code_files: String,
    db: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let conn = db.conn.lock().unwrap();
    let desc = description.unwrap_or_default();
    conn.execute(
        "INSERT INTO project_checkpoints (project_id, name, description, code_files) VALUES (?1, ?2, ?3, ?4)",
        params![project_id, name, desc, code_files],
    ).map_err(|e| e.to_string())?;

    let last_id = conn.last_insert_rowid();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M").to_string();

    Ok(serde_json::json!({
        "id": last_id,
        "project_id": project_id,
        "name": name,
        "description": desc,
        "created_at": now
    }))
}

#[tauri::command]
pub fn list_checkpoints_cmd(
    project_id: i64,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, description, created_at, length(code_files) FROM project_checkpoints WHERE project_id = ?1 ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![project_id], |r| {
            Ok(serde_json::json!({
                "id": r.get::<_, i64>(0)?,
                "name": r.get::<_, String>(1)?,
                "description": r.get::<_, String>(2)?,
                "created_at": r.get::<_, String>(3)?,
                "bytes": r.get::<_, i64>(4)?,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in rows.flatten() {
        list.push(item);
    }
    Ok(list)
}

#[tauri::command]
pub fn restore_checkpoint_cmd(
    checkpoint_id: i64,
    db: State<'_, DbState>,
) -> Result<String, String> {
    let conn = db.conn.lock().unwrap();
    let (pid, files): (i64, String) = conn
        .query_row(
            "SELECT project_id, code_files FROM project_checkpoints WHERE id = ?1",
            params![checkpoint_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| format!("Чекпоинт не найден: {}", e))?;

    conn.execute(
        "UPDATE projects SET code_files = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![files, pid],
    ).map_err(|e| e.to_string())?;

    Ok(files)
}

// -------------------------------------------------------------
// ACTIVITY AUDIT LOG
// -------------------------------------------------------------
#[tauri::command]
pub fn log_activity_cmd(
    project_id: Option<i64>,
    event_type: String,
    description: String,
    metadata: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    let meta = metadata.unwrap_or_default();
    let _ = conn.execute(
        "INSERT INTO activity_logs (project_id, event_type, description, metadata) VALUES (?1, ?2, ?3, ?4)",
        params![project_id, event_type, description, meta],
    );
    Ok(())
}

#[tauri::command]
pub fn get_activities_cmd(
    project_id: Option<i64>,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = db.conn.lock().unwrap();
    let query = if let Some(pid) = project_id {
        format!("SELECT id, project_id, event_type, description, metadata, created_at FROM activity_logs WHERE project_id = {} ORDER BY id DESC LIMIT 50", pid)
    } else {
        "SELECT id, project_id, event_type, description, metadata, created_at FROM activity_logs ORDER BY id DESC LIMIT 50".to_string()
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(serde_json::json!({
                "id": r.get::<_, i64>(0)?,
                "project_id": r.get::<_, Option<i64>>(1)?,
                "event_type": r.get::<_, String>(2)?,
                "description": r.get::<_, String>(3)?,
                "metadata": r.get::<_, String>(4)?,
                "created_at": r.get::<_, String>(5)?,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in rows.flatten() {
        list.push(item);
    }
    Ok(list)
}

// -------------------------------------------------------------
// AI CHAT & AGENT API
// -------------------------------------------------------------
#[tauri::command]
pub async fn ai_chat_cmd(
    provider: String,
    model: String,
    api_key: Option<String>,
    endpoint: Option<String>,
    system_prompt: String,
    user_prompt: String,
    code_context: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let mut full_system = system_prompt.clone();
    if let Some(ref ctx) = code_context {
        full_system.push_str("\n\n--- PROJECT CONTEXT & FILES ---\n");
        full_system.push_str(ctx);
    }

    match provider.to_lowercase().as_str() {
        "ollama" => {
            let base = endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
            let url = format!("{}/api/chat", base.trim_end_matches('/'));
            let body = serde_json::json!({
                "model": model,
                "messages": [
                    { "role": "system", "content": full_system },
                    { "role": "user", "content": user_prompt }
                ],
                "stream": false
            });

            let resp = client.post(&url).json(&body).send().await.map_err(|e| format!("Ollama error: {}", e))?;
            if !resp.status().is_success() {
                return Err(format!("Ollama HTTP {}: {}", resp.status(), resp.text().await.unwrap_or_default()));
            }
            let res_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let reply = res_json["message"]["content"].as_str().unwrap_or("").to_string();
            Ok(reply)
        }
        "anthropic" | "claude" => {
            let key = api_key.ok_or_else(|| "Anthropic API Key required".to_string())?;
            let url = "https://api.anthropic.com/v1/messages";
            let body = serde_json::json!({
                "model": if model.is_empty() { "claude-3-5-sonnet-20241022" } else { &model },
                "max_tokens": 4096,
                "system": full_system,
                "messages": [
                    { "role": "user", "content": user_prompt }
                ]
            });

            let resp = client.post(url)
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Anthropic error: {}", e))?;

            if !resp.status().is_success() {
                return Err(format!("Anthropic HTTP {}: {}", resp.status(), resp.text().await.unwrap_or_default()));
            }
            let res_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let reply = res_json["content"][0]["text"].as_str().unwrap_or("").to_string();
            Ok(reply)
        }
        "gemini" => {
            let key = api_key.ok_or_else(|| "Google Gemini API Key required".to_string())?;
            let mod_name = if model.is_empty() { "gemini-1.5-flash" } else { &model };
            let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", mod_name, key);

            let body = serde_json::json!({
                "system_instruction": {
                    "parts": [{ "text": full_system }]
                },
                "contents": [{
                    "parts": [{ "text": user_prompt }]
                }]
            });

            let resp = client.post(&url).json(&body).send().await.map_err(|e| format!("Gemini error: {}", e))?;
            if !resp.status().is_success() {
                return Err(format!("Gemini HTTP {}: {}", resp.status(), resp.text().await.unwrap_or_default()));
            }
            let res_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let reply = res_json["candidates"][0]["content"]["parts"][0]["text"].as_str().unwrap_or("").to_string();
            Ok(reply)
        }
        _ => {
            // Default: OpenAI or OpenAI-compatible (DeepSeek, Groq, OpenRouter, LM Studio)
            let key = api_key.unwrap_or_default();
            let base_url = endpoint.unwrap_or_else(|| "https://api.openai.com/v1".to_string());
            let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

            let mut req = client.post(&url);
            if !key.is_empty() {
                req = req.header("Authorization", format!("Bearer {}", key));
            }

            let body = serde_json::json!({
                "model": if model.is_empty() { "gpt-4o-mini" } else { &model },
                "messages": [
                    { "role": "system", "content": full_system },
                    { "role": "user", "content": user_prompt }
                ]
            });

            let resp = req.json(&body).send().await.map_err(|e| format!("AI API error: {}", e))?;
            if !resp.status().is_success() {
                return Err(format!("AI API HTTP {}: {}", resp.status(), resp.text().await.unwrap_or_default()));
            }
            let res_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let reply = res_json["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
            Ok(reply)
        }
    }
}

// -------------------------------------------------------------
// GITHUB PULL REQUESTS & ISSUES
// -------------------------------------------------------------
#[tauri::command]
pub async fn github_get_pull_requests_cmd(
    owner: String,
    repo: String,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let token = {
        let conn = db.conn.lock().unwrap();
        conn.query_row("SELECT value FROM settings WHERE key = 'github_token'", [], |r| r.get::<_, String>(0)).ok()
    };
    let client = github_client(token.as_deref())?;
    let url = format!("https://api.github.com/repos/{}/{}/pulls?state=all&per_page=15", owner, repo);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Ok(Vec::new());
    }
    let prs: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
    Ok(prs)
}

#[tauri::command]
pub async fn github_get_issues_cmd(
    owner: String,
    repo: String,
    db: State<'_, DbState>,
) -> Result<Vec<serde_json::Value>, String> {
    let token = {
        let conn = db.conn.lock().unwrap();
        conn.query_row("SELECT value FROM settings WHERE key = 'github_token'", [], |r| r.get::<_, String>(0)).ok()
    };
    let client = github_client(token.as_deref())?;
    let url = format!("https://api.github.com/repos/{}/{}/issues?state=all&per_page=15", owner, repo);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Ok(Vec::new());
    }
    let issues: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
    Ok(issues)
}

// -------------------------------------------------------------
// REAL LOCAL FOLDER & WORKSPACE SYSTEM
// -------------------------------------------------------------

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct DiskCodeFile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub full_path: String,
    pub language: String,
    pub content: String,
}

fn detect_code_language(ext: &str) -> String {
    match ext.to_lowercase().as_str() {
        "html" | "htm" => "html".to_string(),
        "css" | "scss" | "sass" | "less" => "css".to_string(),
        "js" | "jsx" | "mjs" | "cjs" => "javascript".to_string(),
        "ts" | "tsx" | "mts" | "cts" => "typescript".to_string(),
        "json" | "jsonc" => "json".to_string(),
        "md" | "markdown" => "markdown".to_string(),
        "rs" => "rust".to_string(),
        "py" | "pyw" => "python".to_string(),
        "toml" => "toml".to_string(),
        "yaml" | "yml" => "yaml".to_string(),
        "sql" => "sql".to_string(),
        "sh" | "bash" | "zsh" => "shell".to_string(),
        "bat" | "cmd" | "ps1" | "psm1" => "powershell".to_string(),
        "c" | "h" => "c".to_string(),
        "cpp" | "hpp" | "cc" | "cxx" => "cpp".to_string(),
        "cs" => "csharp".to_string(),
        "go" => "go".to_string(),
        "java" => "java".to_string(),
        "kt" | "kts" => "kotlin".to_string(),
        "php" => "php".to_string(),
        "rb" => "ruby".to_string(),
        "xml" | "svg" => "xml".to_string(),
        "txt" | "log" | "env" | "gitignore" => "text".to_string(),
        _ => "text".to_string(),
    }
}

fn scan_folder_recursive(
    root: &Path,
    current: &Path,
    results: &mut Vec<DiskCodeFile>,
    max_files: usize,
) {
    if results.len() >= max_files {
        return;
    }

    let entries = match fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if results.len() >= max_files {
            break;
        }

        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if file_name.starts_with('.') && file_name != ".gitignore" && file_name != ".env" {
            continue;
        }

        if path.is_dir() {
            let lower = file_name.to_lowercase();
            if lower == "node_modules"
                || lower == "target"
                || lower == "dist"
                || lower == "build"
                || lower == ".git"
                || lower == ".vscode"
                || lower == ".idea"
                || lower == "venv"
                || lower == ".venv"
                || lower == "__pycache__"
                || lower == "bin"
                || lower == "obj"
            {
                continue;
            }
            scan_folder_recursive(root, &path, results, max_files);
        } else if path.is_file() {
            if let Ok(meta) = entry.metadata() {
                if meta.len() > 2 * 1024 * 1024 {
                    continue;
                }
            }

            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            let lower_ext = ext.to_lowercase();
            let is_binary_ext = matches!(
                lower_ext.as_str(),
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "ico" | "exe" | "dll" | "so"
                    | "dylib" | "zip" | "tar" | "gz" | "7z" | "rar" | "pdf" | "mp4"
                    | "mp3" | "wav" | "ogg" | "ttf" | "woff" | "woff2" | "eot" | "bin"
                    | "sqlite" | "db"
            );
            if is_binary_ext {
                continue;
            }

            if let Ok(content) = fs::read_to_string(&path) {
                let rel_path = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                let language = detect_code_language(ext);
                let id = format!("disk-{}", results.len() + 1);

                results.push(DiskCodeFile {
                    id,
                    name: file_name,
                    path: rel_path,
                    full_path: path.to_string_lossy().to_string(),
                    language,
                    content,
                });
            }
        }
    }
}

#[tauri::command]
pub fn pick_folder_dialog_cmd() -> Result<Option<String>, String> {
    let script = r#"
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Select a Project Folder"
        $dialog.ShowNewFolderButton = $true
        $win = New-Object System.Windows.Forms.NativeWindow
        $win.AssignHandle([System.Diagnostics.Process]::GetCurrentProcess().MainWindowHandle)
        $res = $dialog.ShowDialog($win)
        if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
            Write-Output $dialog.SelectedPath
        }
    "#;
    let output = std::process::Command::new("powershell")
        .args(&["-NoProfile", "-Command", script])
        .output()
        .map_err(|e| format!("Failed to open folder picker: {}", e))?;

    let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path_str.is_empty() {
        Ok(None)
    } else {
        Ok(Some(path_str))
    }
}

#[tauri::command]
pub fn load_folder_files_cmd(folder_path: String) -> Result<Vec<DiskCodeFile>, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Directory does not exist or is not a folder: {}", folder_path));
    }

    let mut results = Vec::new();
    scan_folder_recursive(path, path, &mut results, 1000);
    results.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(results)
}

#[tauri::command]
pub fn save_file_to_disk_cmd(file_path: String, content: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(path, content).map_err(|e| format!("Failed to write file {}: {}", file_path, e))?;
    Ok(())
}

#[tauri::command]
pub fn create_file_on_disk_cmd(
    folder_path: String,
    rel_path: String,
    content: Option<String>,
) -> Result<DiskCodeFile, String> {
    let root = Path::new(&folder_path);
    let full_path = root.join(&rel_path);
    if let Some(parent) = full_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let body = content.unwrap_or_default();
    fs::write(&full_path, &body).map_err(|e| format!("Failed to create file: {}", e))?;

    let file_name = full_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    let ext = full_path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let language = detect_code_language(ext);

    Ok(DiskCodeFile {
        id: format!("disk-{}", chrono::Utc::now().timestamp_millis()),
        name: file_name,
        path: rel_path.replace('\\', "/"),
        full_path: full_path.to_string_lossy().to_string(),
        language,
        content: body,
    })
}

#[tauri::command]
pub fn delete_file_from_disk_cmd(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    if path.is_file() {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))?;
    } else if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete folder: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_folder_in_explorer_cmd(folder_path: String) -> Result<(), String> {
    let path = Path::new(&folder_path);
    if path.exists() {
        let _ = std::process::Command::new("explorer").arg(&folder_path).spawn();
        Ok(())
    } else {
        Err(format!("Folder does not exist: {}", folder_path))
    }
}

