fn main() {
    let attrs = tauri_build::WindowsAttributes::new()
        .window_icon_path("icons/icon.ico");
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(attrs))
        .expect("failed to run tauri-build");
}
