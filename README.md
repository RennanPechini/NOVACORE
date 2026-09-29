# NOVACORE

Tauri 2 + React + SQLite. Login inicial: gerente / vendedor / caixa / estoque, senha 1234.

## Gerar o .exe pelo GitHub
1. Crie um repositório no GitHub e envie esta pasta:
   git init && git add . && git commit -m "etapa 1" && git branch -M main
   git remote add origin URL_DO_REPO && git push -u origin main
2. Aba **Actions** > "Gerar instalador Windows" (roda sozinho a cada push).
3. Ao terminar (uns 8-15 min na primeira vez), baixe o instalador em **Artifacts**.
4. Para publicar uma versão: `git tag v0.1.0 && git push --tags` (o .exe vai para **Releases**).

## Rodar local (opcional): Node 20 + Rust instalados
npm install && npx tauri icon app-icon.png && npm run tauri dev
