use ff7_lib::ff7;
use ff7_lib::ff7::addresses::FF7Addresses;
use ff7_lib::ff7::types::Scene;
use ff7_lib::utils::memory::write_memory_buffer;
use ff7_lib::utils::process;
use tauri::ipc::Invoke;
use crate::updater::{check_updates, perform_update, UpdateInfo};

#[tauri::command]
pub fn update_mes_data(data: Vec<u8>) -> Result<(), String> {
    if process::is_ff7_running() {
        let addresses = FF7Addresses::new();
        let _ = write_memory_buffer(addresses.world_mes_data, data);
        Ok(())
    } else {
        Err("FF7 is not running".to_string())
    }
}

#[tauri::command]
pub fn is_ff7_running() -> bool {
    process::is_ff7_running()
}

#[tauri::command]
pub fn read_ff7_data() -> Result<ff7::FF7Data, String> {
    ff7::read_data()
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    check_updates(app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_update(app: tauri::AppHandle) -> Result<(), String> {
    perform_update(app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_battle_scenes(game_directory: String) -> Result<Vec<Scene>, String> {
    ff7::data::battle::read_scene_bin_from_path(&std::path::Path::new(&game_directory).join("data/lang-en/battle/scene.bin"))
}

pub fn generate_handler() -> impl Fn(Invoke<tauri::Wry>) -> bool + Send + Sync {
    tauri::generate_handler![
        update_mes_data,
        is_ff7_running,
        read_ff7_data,
        check_for_updates,
        execute_update,
        read_battle_scenes,
    ]
}
