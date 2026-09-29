#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_sql::{Builder, Migration, MigrationKind};

fn main() {
    let migrations = vec![Migration {
        version: 1,
        description: "schema_inicial",
        sql: include_str!("../migrations/001_inicial.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(Builder::default().add_migrations("sqlite:erp.db", migrations).build())
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o ERP");
}
