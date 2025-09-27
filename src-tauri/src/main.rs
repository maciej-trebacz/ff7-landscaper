// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod updater;

use ff7_lib::utils::process;

pub fn main() {
    let process_names = vec!["ff7.exe".to_string(), "ff7_en.exe".to_string()];
    process::initialize(process_names);
    println!("FF7 scanner started");

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(commands::generate_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
