import { useEffect, useMemo, useState } from "react";
import { db, Usuario } from "./db";

type Fab = { id: number; nome: string };
type Prod = {
  id: number; fabricante_id: number; fabricante: string; codigo: string; descricao: string;
  aplicacao: string | null; localizacao: string | null; custo: number; preco: number;
  estoque: number; estoque_minimo: number;
};
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => {
  const t = (s ?? "").trim();
  if (!t) return 0;
  const v = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : parseFloat(t);
  return isNaN(v) ? 0 : v;
};
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function parseCsv(txt: string): string[][] {
  txt = txt.replace(/^\uFEFF/, "");
  const first = txt.split(/\r?\n/)[0] ?? "";
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      row.push(cell); cell = ""; if (row.some((x) => x.trim())) rows.push(row); row = [];
    } else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const VAZIO = { id: 0, fabricante_id: 0, codigo: "", descricao: "", aplicacao: "", localizacao: "", custo: "", preco: "", estoque: "", estoque_minimo: "" };

export default function Produtos({ u }: { u: Usuario }) {
  const podeEditar = u.perfil === "gerente" || u.perfil === "estoque";
  const [fabs, setFabs] = useState<Fab[]>([]);
  const [lista, setLista] = useState<Prod[]>([]);
  const [busca, setBusca] = useState("");
  const [fab, setFab] = useState(0);
  const [form, setForm] = useState<typeof VAZIO | null>(null);
  const [aviso, setAviso] = useState("");

  async function carregar() {
    const d = await db();
    setFabs(await d.select<Fab[]>("SELECT id, nome FROM fabricantes ORDER BY nome"));
    setLista(await d.select<Prod[]>(
      `SELECT p.id, p.fabricante_id, f.nome AS fabricante, p.codigo, p.descricao, p.aplicacao, p.localizacao,
              p.custo, p.preco, p.estoque, p.estoque_minimo
       FROM produtos p JOIN fabricantes f ON f.id = p.fabricante_id
       WHERE p.loja_id = $1 ORDER BY f.nome, p.codigo`, [u.loja_id]));
  }
  useEffect(() => { carregar().catch((e) => setAviso(String(e))); }, []);

  const filtrada = useMemo(() => {
    const t = norm(busca);
    return lista.filter((p) => (!fab || p.fabricante_id === fab) &&
      (!t || norm(`${p.codigo} ${p.descricao} ${p.aplicacao ?? ""} ${p.fabricante}`).includes(t)));
  }, [lista, busca, fab]);

  async function salvar() {
    if (!form) return;
    if (!form.fabricante_id || !form.codigo.trim() || !form.descricao.trim()) {
      setAviso("Escolha o fabricante e preencha código e descrição."); return;
    }
    const d = await db();
    const est = Math.round(num(String(form.estoque)));
    try {
      if (form.id) {
        const antes = lista.find((p) => p.id === form.id)!;
        await d.execute(
          `UPDATE produtos SET fabricante_id=$1, codigo=$2, descricao=$3, aplicacao=$4, localizacao=$5,
           custo=$6, preco=$7, estoque=$8, estoque_minimo=$9 WHERE id=$10`,
          [form.fabricante_id, form.codigo.trim(), form.descricao.trim(), form.aplicacao, form.localizacao,
           num(String(form.custo)), num(String(form.preco)), est, Math.round(num(String(form.estoque_minimo))), form.id]);
        if (est !== antes.estoque)
          await d.execute("INSERT INTO movimentacoes (loja_id, produto_id, usuario_id, tipo, quantidade, origem) VALUES ($1,$2,$3,'ajuste',$4,'edição do produto')",
            [u.loja_id, form.id, u.id, est - antes.estoque]);
      } else {
        const r = await d.execute(
          `INSERT INTO produtos (loja_id, fabricante_id, codigo, descricao, aplicacao, localizacao, custo, preco, estoque, estoque_minimo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [u.loja_id, form.fabricante_id, form.codigo.trim(), form.descricao.trim(), form.aplicacao, form.localizacao,
           num(String(form.custo)), num(String(form.preco)), est, Math.round(num(String(form.estoque_minimo)))]);
        if (est > 0 && r.lastInsertId)
          await d.execute("INSERT INTO movimentacoes (loja_id, produto_id, usuario_id, tipo, quantidade, origem) VALUES ($1,$2,$3,'entrada',$4,'cadastro')",
            [u.loja_id, r.lastInsertId, u.id, est]);
      }
      setForm(null); setAviso("Produto salvo."); await carregar();
    } catch (e) {
      setAviso("Não foi possível salvar. Esse código já existe para o fabricante? " + String(e));
    }
  }

  async function importar(file: File) {
    setAviso("Importando...");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { setAviso("A planilha está vazia. Use o modelo em exemplos/modelo-importacao.csv."); return; }
    const cab = rows[0].map(norm);
    const col = (n: string) => cab.indexOf(n);
    if (col("fabricante") < 0 || col("codigo") < 0 || col("descricao") < 0) {
      setAviso("Faltam colunas. O cabeçalho precisa ter: fabricante, codigo, descricao."); return;
    }
    const d = await db();
    const mapa = new Map((await d.select<Fab[]>("SELECT id, nome FROM fabricantes")).map((f) => [norm(f.nome), f.id]));
    let novos = 0, atualizados = 0, ignorados = 0;
    const get = (r: string[], n: string) => (col(n) >= 0 ? (r[col(n)] ?? "").trim() : "");
    for (const r of rows.slice(1)) {
      const nomeFab = get(r, "fabricante"), codigo = get(r, "codigo"), desc = get(r, "descricao");
      if (!nomeFab || !codigo || !desc) { ignorados++; continue; }
      let fid = mapa.get(norm(nomeFab));
      if (!fid) {
        const ins = await d.execute("INSERT INTO fabricantes (nome) VALUES ($1)", [nomeFab]);
        fid = ins.lastInsertId as number; mapa.set(norm(nomeFab), fid);
      }
      const ex = await d.select<{ id: number }[]>("SELECT id FROM produtos WHERE loja_id=$1 AND fabricante_id=$2 AND codigo=$3", [u.loja_id, fid, codigo]);
      if (ex[0]) {
        await d.execute("UPDATE produtos SET descricao=$1, aplicacao=$2, localizacao=$3, custo=$4, preco=$5, estoque_minimo=$6 WHERE id=$7",
          [desc, get(r, "aplicacao"), get(r, "localizacao"), num(get(r, "custo")), num(get(r, "preco")), Math.round(num(get(r, "estoque_minimo"))), ex[0].id]);
        atualizados++;
      } else {
        const est = Math.round(num(get(r, "estoque")));
        const ins = await d.execute(
          "INSERT INTO produtos (loja_id, fabricante_id, codigo, descricao, aplicacao, localizacao, custo, preco, estoque, estoque_minimo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [u.loja_id, fid, codigo, desc, get(r, "aplicacao"), get(r, "localizacao"), num(get(r, "custo")), num(get(r, "preco")), est, Math.round(num(get(r, "estoque_minimo")))]);
        if (est > 0 && ins.lastInsertId)
          await d.execute("INSERT INTO movimentacoes (loja_id, produto_id, usuario_id, tipo, quantidade, origem) VALUES ($1,$2,$3,'entrada',$4,'importação')", [u.loja_id, ins.lastInsertId, u.id, est]);
        novos++;
      }
    }
    setAviso(`Importação concluída: ${novos} novos, ${atualizados} atualizados, ${ignorados} ignorados.`);
    await carregar();
  }

  const set = (k: keyof typeof VAZIO, v: string | number) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="prod">
      <div className="barra">
        <input placeholder="Buscar por código, descrição ou aplicação" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={fab} onChange={(e) => setFab(Number(e.target.value))}>
          <option value={0}>Todos os fabricantes</option>
          {fabs.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        {podeEditar && <>
          <button className="prim" onClick={() => setForm({ ...VAZIO })}>Novo produto</button>
          <label className="btn">Importar planilha
            <input type="file" accept=".csv,.txt" hidden onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
          </label>
        </>}
      </div>
      {aviso && <p className="aviso" role="status">{aviso}</p>}

      {form && (
        <div className="cartao form">
          <h3>{form.id ? "Editar produto" : "Novo produto"}</h3>
          <div className="grade">
            <label>Fabricante
              <select value={form.fabricante_id} onChange={(e) => set("fabricante_id", Number(e.target.value))}>
                <option value={0}>Escolha...</option>
                {fabs.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </label>
            <label>Código<input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} /></label>
            <label className="larga">Descrição<input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} /></label>
            <label className="larga">Aplicação (marca, modelo, ano)<input value={form.aplicacao ?? ""} onChange={(e) => set("aplicacao", e.target.value)} /></label>
            <label>Localização<input value={form.localizacao ?? ""} onChange={(e) => set("localizacao", e.target.value)} /></label>
            <label>Custo (R$)<input value={form.custo} onChange={(e) => set("custo", e.target.value)} /></label>
            <label>Preço (R$)<input value={form.preco} onChange={(e) => set("preco", e.target.value)} /></label>
            <label>Estoque<input value={form.estoque} onChange={(e) => set("estoque", e.target.value)} /></label>
            <label>Estoque mínimo<input value={form.estoque_minimo} onChange={(e) => set("estoque_minimo", e.target.value)} /></label>
          </div>
          <div className="acoes">
            <button className="prim" onClick={salvar}>Salvar produto</button>
            <button onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <p className="vazio">Nenhum produto ainda. {podeEditar ? "Use “Importar planilha” com o catálogo do fabricante ou cadastre um a um." : "Peça ao setor de estoque para cadastrar."}</p>
      ) : (
        <div className="rolagem">
          <table>
            <thead><tr><th>Fabricante</th><th>Código</th><th>Descrição</th><th>Aplicação</th><th>Local</th><th className="n">Preço</th><th className="n">Estoque</th>{podeEditar && <th />}</tr></thead>
            <tbody>
              {filtrada.map((p) => (
                <tr key={p.id} className={p.estoque <= p.estoque_minimo ? "baixo" : ""}>
                  <td>{p.fabricante}</td><td>{p.codigo}</td><td>{p.descricao}</td><td>{p.aplicacao}</td><td>{p.localizacao}</td>
                  <td className="n">{brl(p.preco)}</td><td className="n">{p.estoque}</td>
                  {podeEditar && <td><button className="link" onClick={() => setForm({ ...p, aplicacao: p.aplicacao ?? "", localizacao: p.localizacao ?? "", custo: String(p.custo), preco: String(p.preco), estoque: String(p.estoque), estoque_minimo: String(p.estoque_minimo) })}>Editar</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rodape">{filtrada.length} de {lista.length} produtos. Linhas marcadas estão com estoque no mínimo ou abaixo.</p>
        </div>
      )}
    </div>
  );
}
