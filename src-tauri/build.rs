use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let src_dir = Path::new(&manifest_dir).join("src");
    let picker_c = src_dir.join("picker.c");
    let picker_o = src_dir.join("picker.o");
    let lib_picker = Path::new(&manifest_dir).join("libpicker.a");

    // Rebuild libpicker.a if picker.c changes or libpicker.a missing
    println!("cargo:rerun-if-changed={}", picker_c.display());
    let _ = Command::new("gcc")
        .args(&["-c", "-O2", picker_c.to_str().unwrap(), "-o", picker_o.to_str().unwrap()])
        .status();
    let _ = Command::new("ar")
        .args(&["rcs", lib_picker.to_str().unwrap(), picker_o.to_str().unwrap()])
        .status();

    println!("cargo:rustc-link-search=native={}", manifest_dir);
    println!("cargo:rustc-link-lib=static=picker");
    println!("cargo:rustc-link-lib=ole32");
    println!("cargo:rustc-link-lib=shell32");
    println!("cargo:rustc-link-lib=uuid");

    let attrs = tauri_build::WindowsAttributes::new()
        .window_icon_path("icons/icon.ico");
    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(attrs))
        .expect("failed to run tauri-build");
}
