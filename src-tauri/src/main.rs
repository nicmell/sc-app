// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if !sc_app_lib::cli::run() {
        sc_app_lib::run();
    }
}
