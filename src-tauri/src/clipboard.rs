use arboard::Clipboard;
use std::sync::Mutex;

pub struct ClipboardState {
    pub last_content: Mutex<String>,
}

impl ClipboardState {
    pub fn new() -> Self {
        Self {
            last_content: Mutex::new(String::new()),
        }
    }

    pub fn get_current_text(&self) -> Result<String, String> {
        let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
        cb.get_text().map_err(|e| e.to_string())
    }

    pub fn set_text(&self, text: &str) -> Result<(), String> {
        let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
        cb.set_text(text.to_string()).map_err(|e| e.to_string())?;
        let mut last = self.last_content.lock().unwrap();
        *last = text.to_string();
        Ok(())
    }
}
