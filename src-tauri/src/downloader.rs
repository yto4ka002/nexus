use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct DownloaderState {
    pub cancel_handles: Arc<Mutex<HashMap<i64, Arc<AtomicBool>>>>,
}

impl DownloaderState {
    pub fn new() -> Self {
        Self {
            cancel_handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn cancel(&self, id: i64) -> bool {
        let mut map = self.cancel_handles.lock().unwrap();
        if let Some(flag) = map.remove(&id) {
            flag.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    pub fn register(&self, id: i64) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.cancel_handles.lock().unwrap().insert(id, flag.clone());
        flag
    }
}

pub fn categorize_file(filename: &str) -> String {
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" => "Archives".to_string(),
        "exe" | "msi" | "bat" | "cmd" | "apk" => "Programs".to_string(),
        "pdf" | "doc" | "docx" | "txt" | "md" | "xls" | "xlsx" | "pptx" => "Documents".to_string(),
        "mp3" | "wav" | "flac" | "mp4" | "mkv" | "avi" | "mov" | "webm" => "Media".to_string(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" => "Images".to_string(),
        _ => "Other".to_string(),
    }
}
