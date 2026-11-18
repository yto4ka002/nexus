mod clipboard;
mod commands;
mod db;
mod downloader;
mod system_monitor;

use clipboard::ClipboardState;
use commands::*;
use db::init_db;
use downloader::DownloaderState;
use system_monitor::MonitorState;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state = match init_db() {
        Ok(state) => state,
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            panic!("Database initialization failed");
        }
    };

    let monitor_state = MonitorState::new();
    let downloader_state = DownloaderState::new();
    let clipboard_state = ClipboardState::new();

    tauri::Builder::default()
        .manage(db_state)
        .manage(monitor_state)
        .manage(downloader_state)
        .manage(clipboard_state)
        .setup(|app| {
            // Load explicit black & purple icon for window and tray
            let app_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/128x128.png"))
                .expect("valid icon PNG");

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(app_icon.clone());
            }

            // Build Tray Menu
            let toggle_item = MenuItemBuilder::with_id("toggle", "Open NEXUS").build(app)?;
            let quick_access_item = MenuItemBuilder::with_id("quick_access", "Quick Access (Ctrl+Space)").build(app)?;
            let separator = MenuItemBuilder::with_id("sep", "---").enabled(false).build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Exit NEXUS").build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[&toggle_item, &quick_access_item, &separator, &quit_item])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app_icon.clone())
                .tooltip("NEXUS Command Center")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_always_on_top(true);
                            let _ = window.set_focus();
                            let _ = window.set_always_on_top(false);
                        }
                    }
                    "quick_access" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_always_on_top(true);
                            let _ = window.set_focus();
                            let _ = window.set_always_on_top(false);
                            let _ = window.emit("quick-access:open", ());
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            let is_minimized = window.is_minimized().unwrap_or(false);
                            if is_visible && !is_minimized {
                                let _ = window.hide();
                            } else {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_always_on_top(true);
                                let _ = window.set_focus();
                                let _ = window.set_always_on_top(false);
                            }
                        }
                    }
                })
                .build(app)?;

            // Register global shortcut plugin & Ctrl+Space hotkey
            let app_handle = app.handle().clone();
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |_app, _shortcut, event| {
                        if event.state() == ShortcutState::Pressed {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                let is_minimized = window.is_minimized().unwrap_or(false);
                                let is_focused = window.is_focused().unwrap_or(false);

                                if is_visible && !is_minimized && is_focused {
                                    let _ = window.emit("quick-access:toggle", ());
                                } else {
                                    let _ = window.unminimize();
                                    let _ = window.show();
                                    let _ = window.set_always_on_top(true);
                                    let _ = window.set_focus();
                                    let _ = window.set_always_on_top(false);
                                    let _ = window.emit("quick-access:open", ());
                                }
                            }
                        }
                    })
                    .build(),
            )?;

            // Register default shortcut Ctrl+Space
            let ctrl_space: Shortcut = "Ctrl+Space".parse().unwrap();
            let _ = app.global_shortcut().register(ctrl_space);

            // Handle CLI startup arguments (e.g. autostart / minimized on Windows boot)
            let args: Vec<String> = std::env::args().collect();
            let autostart_boot = args.iter().any(|arg| arg == "--autostart" || arg == "--minimized");
            if autostart_boot {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            // Ensure Windows Registry Autostart is configured
            #[cfg(target_os = "windows")]
            {
                if let Ok(current_exe) = std::env::current_exe() {
                    let exe_path = current_exe.to_string_lossy().to_string();
                    if !exe_path.is_empty() {
                        let reg_val = format!("\"{}\" --autostart", exe_path);
                        let _ = std::process::Command::new("reg")
                            .args(&[
                                "add",
                                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                                "/v",
                                "NEXUS",
                                "/t",
                                "REG_SZ",
                                "/d",
                                &reg_val,
                                "/f",
                            ])
                            .status();
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // By default minimize to tray instead of exiting
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_projects,
            create_project,
            update_project,
            delete_project,
            get_tasks,
            create_task,
            update_task,
            update_task_column,
            delete_task,
            get_notes,
            create_note,
            update_note,
            delete_note,
            get_launcher_items,
            create_launcher_item,
            update_launcher_item,
            delete_launcher_item,
            launch_target,
            get_system_stats,
            kill_process_cmd,
            run_system_command,
            send_system_media_key,
            open_music_service,
            get_downloads,
            start_download_cmd,
            cancel_download_cmd,
            open_download_file,
            open_download_folder,
            delete_download,
            sync_clipboard_cmd,
            get_clipboard_history,
            set_clipboard_text_cmd,
            toggle_clipboard_pin,
            toggle_clipboard_favorite,
            delete_clipboard_item,
            clear_clipboard_history,
            get_calendar_events,
            create_calendar_event,
            update_calendar_event,
            delete_calendar_event,
            get_automation_rules,
            create_automation_rule,
            toggle_automation_rule,
            delete_automation_rule,
            execute_automation_rule_now,
            fetch_weather,
            check_website_ping,
            get_notifications,
            mark_all_notifications_read,
            clear_all_notifications,
            get_app_settings,
            save_app_setting,
            set_autostart_cmd,
            is_autostart_enabled_cmd,
            export_backup_json,
            import_backup_json,
            get_db_path,
            read_project_files_cmd,
            save_project_file_cmd,
            create_project_file_cmd,
            delete_project_file_cmd,
            git_status_cmd,
            git_commit_cmd,
            git_push_cmd,
            ping_dev_server_cmd,
            github_login_cmd,
            github_get_user_cmd,
            github_logout_cmd,
            github_list_repos_cmd,
            github_search_repos_cmd,
            github_import_repo_cmd,
            window_minimize_cmd,
            window_toggle_maximize_cmd,
            window_close_cmd,
            run_project_terminal_cmd,
            git_diff_cmd,
            create_checkpoint_cmd,
            list_checkpoints_cmd,
            restore_checkpoint_cmd,
            log_activity_cmd,
            get_activities_cmd,
            ai_chat_cmd,
            github_get_pull_requests_cmd,
            github_get_issues_cmd,
            pick_folder_dialog_cmd,
            load_folder_files_cmd,
            save_file_to_disk_cmd,
            create_file_on_disk_cmd,
            delete_file_from_disk_cmd,
            open_folder_in_explorer_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
