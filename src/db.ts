import Database from "@tauri-apps/plugin-sql";

export type Perfil = "gerente" | "vendedor" | "caixa" | "estoque";
export type Usuario = { id: number; loja_id: number; nome: string; login: string; perfil: Perfil };

let conn: Database | null = null;
export async function db() {
  if (!conn) conn = await Database.load("sqlite:erp.db");
  return conn;
}

export async function sha256(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function entrar(login: string, senha: string): Promise<Usuario | null> {
  const d = await db();
  const rows = await d.select<Usuario[]>(
    "SELECT id, loja_id, nome, login, perfil FROM usuarios WHERE login = $1 AND senha_hash = $2 AND ativo = 1",
    [login.trim().toLowerCase(), await sha256(senha)]
  );
  return rows[0] ?? null;
}
