import { useCallback, useEffect, useState } from "react";
import { db, sha256, Usuario, Perfil } from "./db";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sel = async <T,>(s: string, a: unknown[] = []) => (await db()).select<T[]>(s, a);
const exe = async (s: string, a: unknown[] = []) => (await db()).execute(s, a);
const num = (s: string) => { const t = s.trim(); if (!t) return 0; const v = t.includes(",") ? parseFloat(t.replace(/\./g, "").replace(",", ".")) : parseFloat(t); return isNaN(v) ? 0 : v; };
const Aviso = ({ t }: { t: string }) => (t ? <p className="aviso" role="status">{t}</p> : null);
const data = (s: string) => new Date(s.replace(" ", "T") + "Z").toLocaleString("pt-BR");
const mov = (L: number, p: number, uid: number, tipo: string, q: number, o: string) =>
  exe("INSERT INTO movimentacoes (loja_id,produto_id,usuario_id,tipo,quantidade,origem) VALUES ($1,$2,$3,$4,$5,$6)", [L, p, uid, tipo, q, o]);

/* ---------- Vendedor: pedidos ---------- */
type PP = { id: number; codigo: string; descricao: string; fabricante: string; preco: number; estoque: number };
type Ped = { id: number; cliente: string | null; vendedor: string; status: string; total: number; criado_em: string };
export function Pedidos({ u }: { u: Usuario }) {
  const [busca, setBusca] = useState(""); const [achados, setAchados] = useState<PP[]>([]);
  const [cart, setCart] = useState<{ p: PP; qtd: number }[]>([]);
  const [cliente, setCliente] = useState(""); const [aviso, setAviso] = useState(""); const [peds, setPeds] = useState<Ped[]>([]);
  const carregar = useCallback(async () => {
    const so = u.perfil === "gerente" ? "" : " AND p.vendedor_id=" + u.id;
    setPeds(await sel<Ped>(`SELECT p.id, c.nome AS cliente, v.nome AS vendedor, p.status, p.total, p.criado_em FROM pedidos p JOIN usuarios v ON v.id=p.vendedor_id LEFT JOIN clientes c ON c.id=p.cliente_id WHERE p.loja_id=$1${so} ORDER BY p.id DESC LIMIT 30`, [u.loja_id]));
  }, [u]);
  useEffect(() => { carregar().catch((e) => setAviso(String(e))); }, [carregar]);
  useEffect(() => {
    const t = busca.trim(); if (t.length < 2) { setAchados([]); return; }
    sel<PP>(`SELECT p.id,p.codigo,p.descricao,f.nome AS fabricante,p.preco,p.estoque FROM produtos p JOIN fabricantes f ON f.id=p.fabricante_id WHERE p.loja_id=$1 AND (p.codigo LIKE $2 OR p.descricao LIKE $2 OR p.aplicacao LIKE $2 OR f.nome LIKE $2) ORDER BY p.codigo LIMIT 15`, [u.loja_id, `%${t}%`]).then(setAchados);
  }, [busca]);
  const total = cart.reduce((s, i) => s + i.p.preco * i.qtd, 0);
  const add = (p: PP) => setCart((c) => c.find((i) => i.p.id === p.id) ? c.map((i) => i.p.id === p.id ? { ...i, qtd: i.qtd + 1 } : i) : [...c, { p, qtd: 1 }]);
  async function salvar() {
    if (!cart.length) return;
    for (const i of cart) if (i.qtd > i.p.estoque) { setAviso(`Estoque insuficiente de ${i.p.codigo}: só há ${i.p.estoque}.`); return; }
    try {
      let cid: number | null = null;
      if (cliente.trim()) cid = (await exe("INSERT INTO clientes (loja_id,nome) VALUES ($1,$2)", [u.loja_id, cliente.trim()])).lastInsertId as number;
      const r = await exe("INSERT INTO pedidos (loja_id,cliente_id,vendedor_id,total) VALUES ($1,$2,$3,$4)", [u.loja_id, cid, u.id, total]);
      for (const i of cart) await exe("INSERT INTO pedido_itens (pedido_id,produto_id,quantidade,preco_unit) VALUES ($1,$2,$3,$4)", [r.lastInsertId, i.p.id, i.qtd, i.p.preco]);
      setAviso(`Pedido ${r.lastInsertId} enviado ao caixa.`); setCart([]); setCliente(""); setBusca(""); await carregar();
    } catch (e) { setAviso("Não foi possível salvar o pedido: " + String(e)); }
  }
  async function cancelar(id: number) { await exe("UPDATE pedidos SET status='cancelado' WHERE id=$1 AND status='aberto'", [id]); await carregar(); }
  return (
    <div className="prod">
      <Aviso t={aviso} />
      <div className="cartao">
        <h3>Novo pedido</h3>
        <div className="barra">
          <input placeholder="Buscar peça por código, descrição ou aplicação" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <input placeholder="Nome do cliente (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </div>
        {achados.length > 0 && <table><tbody>{achados.map((p) => (
          <tr key={p.id}><td>{p.fabricante}</td><td>{p.codigo}</td><td>{p.descricao}</td><td className="n">{brl(p.preco)}</td><td className="n">{p.estoque} em estoque</td>
            <td><button disabled={p.estoque <= 0} onClick={() => add(p)}>Adicionar</button></td></tr>))}</tbody></table>}
        {cart.length > 0 && <>
          <h3>Itens do pedido</h3>
          <table><tbody>{cart.map((i) => (
            <tr key={i.p.id}><td>{i.p.codigo}</td><td>{i.p.descricao}</td>
              <td><input type="number" min={1} style={{ width: 70 }} value={i.qtd} onChange={(e) => setCart((c) => c.map((x) => x.p.id === i.p.id ? { ...x, qtd: Math.max(1, Number(e.target.value)) } : x))} /></td>
              <td className="n">{brl(i.p.preco * i.qtd)}</td>
              <td><button className="link" onClick={() => setCart((c) => c.filter((x) => x.p.id !== i.p.id))}>Remover</button></td></tr>))}</tbody></table>
          <div className="acoes"><strong>Total: {brl(total)}</strong><button className="prim" onClick={salvar}>Enviar ao caixa</button></div>
        </>}
      </div>
      <h3>Pedidos recentes</h3>
      <div className="rolagem"><table>
        <thead><tr><th>Nº</th><th>Cliente</th><th>Vendedor</th><th>Situação</th><th className="n">Total</th><th>Data</th><th /></tr></thead>
        <tbody>{peds.map((p) => (<tr key={p.id}><td>{p.id}</td><td>{p.cliente ?? "Balcão"}</td><td>{p.vendedor}</td><td>{p.status}</td><td className="n">{brl(p.total)}</td><td>{data(p.criado_em)}</td>
          <td>{p.status === "aberto" && <button className="link" onClick={() => cancelar(p.id)}>Cancelar</button>}</td></tr>))}</tbody></table></div>
    </div>
  );
}

/* ---------- Caixa ---------- */
type Cx = { id: number; valor_inicial: number; aberto_em: string };
type Ab = { id: number; cliente: string | null; total: number };
export function Caixa({ u }: { u: Usuario }) {
  const [cx, setCx] = useState<Cx | null>(null); const [ini, setIni] = useState("");
  const [abertos, setAbertos] = useState<Ab[]>([]); const [ped, setPed] = useState(0);
  const [forma, setForma] = useState("dinheiro"); const [recebido, setRecebido] = useState("");
  const [tot, setTot] = useState<{ forma: string; v: number }[]>([]); const [contado, setContado] = useState(""); const [aviso, setAviso] = useState("");
  const carregar = useCallback(async () => {
    const c = (await sel<Cx>("SELECT id,valor_inicial,aberto_em FROM caixas WHERE loja_id=$1 AND usuario_id=$2 AND fechado_em IS NULL ORDER BY id DESC LIMIT 1", [u.loja_id, u.id]))[0] ?? null;
    setCx(c);
    if (c) {
      setAbertos(await sel<Ab>("SELECT p.id, k.nome AS cliente, p.total FROM pedidos p LEFT JOIN clientes k ON k.id=p.cliente_id WHERE p.loja_id=$1 AND p.status='aberto' ORDER BY p.id", [u.loja_id]));
      setTot(await sel("SELECT forma, SUM(valor) AS v FROM pagamentos WHERE caixa_id=$1 GROUP BY forma", [c.id]));
    }
  }, [u]);
  useEffect(() => { carregar().catch((e) => setAviso(String(e))); }, [carregar]);
  const abrir = async () => { await exe("INSERT INTO caixas (loja_id,usuario_id,valor_inicial) VALUES ($1,$2,$3)", [u.loja_id, u.id, num(ini)]); setIni(""); setAviso("Caixa aberto."); await carregar(); };
  const p = abertos.find((x) => x.id === ped);
  async function receber() {
    if (!p || !cx) return;
    const itens = await sel<{ produto_id: number; quantidade: number; codigo: string; estoque: number }>("SELECT i.produto_id,i.quantidade,pr.codigo,pr.estoque FROM pedido_itens i JOIN produtos pr ON pr.id=i.produto_id WHERE i.pedido_id=$1", [p.id]);
    const falta = itens.find((i) => i.quantidade > i.estoque);
    if (falta) { setAviso(`Estoque insuficiente de ${falta.codigo}. Peça ao vendedor para ajustar o pedido.`); return; }
    if (forma === "dinheiro" && recebido && num(recebido) < p.total) { setAviso("O valor recebido é menor que o total do pedido."); return; }
    await exe("INSERT INTO pagamentos (pedido_id,caixa_id,forma,valor) VALUES ($1,$2,$3,$4)", [p.id, cx.id, forma, p.total]);
    await exe("UPDATE pedidos SET status='pago' WHERE id=$1", [p.id]);
    for (const i of itens) { await exe("UPDATE produtos SET estoque=estoque-$1 WHERE id=$2", [i.quantidade, i.produto_id]); await mov(u.loja_id, i.produto_id, u.id, "venda", -i.quantidade, "pedido " + p.id); }
    setAviso(`Pedido ${p.id} pago.` + (forma === "dinheiro" && recebido ? ` Troco: ${brl(num(recebido) - p.total)}.` : ""));
    setPed(0); setRecebido(""); await carregar();
  }
  async function fechar() {
    if (!cx) return;
    const esperado = cx.valor_inicial + (tot.find((t) => t.forma === "dinheiro")?.v ?? 0);
    await exe("UPDATE caixas SET fechado_em=CURRENT_TIMESTAMP, valor_final=$1 WHERE id=$2", [num(contado), cx.id]);
    const dif = num(contado) - esperado;
    setAviso(`Caixa fechado. Esperado em dinheiro: ${brl(esperado)}. Contado: ${brl(num(contado))}. ` + (dif === 0 ? "Sem diferença." : `Diferença: ${brl(dif)}.`));
    setContado(""); await carregar();
  }
  if (!cx) return (<div className="prod"><Aviso t={aviso} /><div className="cartao"><h3>Abrir caixa</h3>
    <label>Troco inicial (R$)<input value={ini} onChange={(e) => setIni(e.target.value)} /></label>
    <div className="acoes"><button className="prim" onClick={abrir}>Abrir caixa</button></div></div></div>);
  return (
    <div className="prod"><Aviso t={aviso} />
      <div className="cartao"><h3>Receber pedido</h3>
        {abertos.length === 0 ? <p className="vazio">Nenhum pedido aguardando pagamento.</p> : <>
          <div className="barra">
            <select value={ped} onChange={(e) => setPed(Number(e.target.value))}>
              <option value={0}>Escolha o pedido...</option>
              {abertos.map((a) => <option key={a.id} value={a.id}>Pedido {a.id} - {a.cliente ?? "Balcão"} - {brl(a.total)}</option>)}
            </select>
            <select value={forma} onChange={(e) => setForma(e.target.value)}>
              <option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="credito">Cartão de crédito</option><option value="debito">Cartão de débito</option>
            </select>
            {forma === "dinheiro" && <input placeholder="Valor recebido" value={recebido} onChange={(e) => setRecebido(e.target.value)} />}
            <button className="prim" disabled={!p} onClick={receber}>Confirmar pagamento</button>
          </div></>}
      </div>
      <div className="cartao"><h3>Fechamento</h3>
        <p>Aberto em {data(cx.aberto_em)} com troco inicial de {brl(cx.valor_inicial)}.</p>
        <table><tbody>{tot.map((t) => <tr key={t.forma}><td>{t.forma}</td><td className="n">{brl(t.v)}</td></tr>)}</tbody></table>
        <div className="barra"><input placeholder="Dinheiro contado na gaveta" value={contado} onChange={(e) => setContado(e.target.value)} />
          <button onClick={fechar}>Fechar caixa</button></div>
      </div>
    </div>
  );
}

/* ---------- Estoque ---------- */
export function Entrada({ u }: { u: Usuario }) {
  const [prods, setProds] = useState<{ id: number; codigo: string; descricao: string; fabricante: string }[]>([]);
  const [pid, setPid] = useState(0); const [qtd, setQtd] = useState(""); const [custo, setCusto] = useState(""); const [nf, setNf] = useState(""); const [aviso, setAviso] = useState("");
  useEffect(() => { sel<any>("SELECT p.id,p.codigo,p.descricao,f.nome AS fabricante FROM produtos p JOIN fabricantes f ON f.id=p.fabricante_id WHERE p.loja_id=$1 ORDER BY f.nome,p.codigo", [u.loja_id]).then(setProds); }, []);
  async function salvar() {
    const q = Math.round(num(qtd));
    if (!pid || q <= 0) { setAviso("Escolha o produto e informe uma quantidade maior que zero."); return; }
    await exe("UPDATE produtos SET estoque=estoque+$1, custo=CASE WHEN $2>0 THEN $2 ELSE custo END WHERE id=$3", [q, num(custo), pid]);
    await mov(u.loja_id, pid, u.id, "entrada", q, "NF " + (nf || "sem número"));
    setAviso("Entrada registrada."); setQtd(""); setCusto(""); setNf("");
  }
  return (<div className="prod"><Aviso t={aviso} /><div className="cartao form"><h3>Entrada de mercadoria</h3><div className="grade">
    <label className="larga">Produto<select value={pid} onChange={(e) => setPid(Number(e.target.value))}><option value={0}>Escolha...</option>
      {prods.map((p) => <option key={p.id} value={p.id}>{p.fabricante} - {p.codigo} - {p.descricao}</option>)}</select></label>
    <label>Quantidade<input value={qtd} onChange={(e) => setQtd(e.target.value)} /></label>
    <label>Custo unitário (R$)<input value={custo} onChange={(e) => setCusto(e.target.value)} /></label>
    <label>Nº da nota do fornecedor<input value={nf} onChange={(e) => setNf(e.target.value)} /></label></div>
    <div className="acoes"><button className="prim" onClick={salvar}>Registrar entrada</button></div></div></div>);
}

export function Movimentacoes({ u }: { u: Usuario }) {
  const [l, setL] = useState<any[]>([]);
  useEffect(() => { sel("SELECT m.criado_em,m.tipo,m.quantidade,m.origem,p.codigo,p.descricao,us.nome AS usuario FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id LEFT JOIN usuarios us ON us.id=m.usuario_id WHERE m.loja_id=$1 ORDER BY m.id DESC LIMIT 100", [u.loja_id]).then(setL); }, []);
  return l.length === 0 ? <p className="vazio">Nenhuma movimentação ainda.</p> : (<div className="rolagem prod"><table>
    <thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th className="n">Qtde</th><th>Origem</th><th>Usuário</th></tr></thead>
    <tbody>{l.map((m, i) => <tr key={i}><td>{data(m.criado_em)}</td><td>{m.tipo}</td><td>{m.codigo} - {m.descricao}</td><td className="n">{m.quantidade}</td><td>{m.origem}</td><td>{m.usuario}</td></tr>)}</tbody></table></div>);
}

/* ---------- Gerente ---------- */
export function Painel({ u }: { u: Usuario }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { (async () => {
    const L = u.loja_id, one = async (s: string) => ((await sel<{ v: number }>(s, [L]))[0]?.v) ?? 0;
    const base = "FROM pagamentos g JOIN pedidos p ON p.id=g.pedido_id WHERE p.loja_id=$1 AND ";
    const mes = "strftime('%Y-%m',p.criado_em,'localtime')=strftime('%Y-%m','now','localtime')";
    setD({
      hoje: await one("SELECT COALESCE(SUM(g.valor),0) AS v " + base + "date(g.criado_em,'localtime')=date('now','localtime')"),
      mes: await one("SELECT COALESCE(SUM(g.valor),0) AS v " + base + mes.replace("p.criado_em", "g.criado_em")),
      margem: await one("SELECT COALESCE(SUM((i.preco_unit-pr.custo)*i.quantidade),0) AS v FROM pedido_itens i JOIN pedidos p ON p.id=i.pedido_id JOIN produtos pr ON pr.id=i.produto_id WHERE p.loja_id=$1 AND p.status='pago' AND " + mes),
      abertos: await one("SELECT COUNT(*) AS v FROM pedidos p WHERE p.loja_id=$1 AND p.status='aberto'"),
      baixo: await sel("SELECT codigo,descricao,estoque,estoque_minimo FROM produtos WHERE loja_id=$1 AND estoque<=estoque_minimo ORDER BY estoque LIMIT 8", [L]),
      top: await sel("SELECT pr.codigo,pr.descricao,SUM(i.quantidade) AS qtd FROM pedido_itens i JOIN pedidos p ON p.id=i.pedido_id JOIN produtos pr ON pr.id=i.produto_id WHERE p.loja_id=$1 AND p.status='pago' GROUP BY pr.id ORDER BY qtd DESC LIMIT 5", [L]),
    });
  })().catch(() => {}); }, []);
  if (!d) return <p className="vazio">Carregando...</p>;
  return (<div className="prod">
    <div className="numeros">
      <div><span>Vendas hoje</span><strong>{brl(d.hoje)}</strong></div>
      <div><span>Vendas no mês</span><strong>{brl(d.mes)}</strong></div>
      <div><span>Margem no mês</span><strong>{brl(d.margem)}</strong></div>
      <div><span>Pedidos aguardando caixa</span><strong>{d.abertos}</strong></div>
    </div>
    <div className="dupla">
      <div className="cartao"><h3>Estoque no mínimo ou abaixo</h3>{d.baixo.length === 0 ? <p className="vazio">Nada em falta.</p> :
        <table><tbody>{d.baixo.map((p: any) => <tr key={p.codigo}><td>{p.codigo}</td><td>{p.descricao}</td><td className="n">{p.estoque}/{p.estoque_minimo}</td></tr>)}</tbody></table>}</div>
      <div className="cartao"><h3>Mais vendidos</h3>{d.top.length === 0 ? <p className="vazio">Ainda sem vendas pagas.</p> :
        <table><tbody>{d.top.map((p: any) => <tr key={p.codigo}><td>{p.codigo}</td><td>{p.descricao}</td><td className="n">{p.qtd}</td></tr>)}</tbody></table>}</div>
    </div></div>);
}

export function Usuarios({ u }: { u: Usuario }) {
  const [l, setL] = useState<any[]>([]); const [f, setF] = useState({ nome: "", login: "", senha: "", perfil: "vendedor" as Perfil }); const [aviso, setAviso] = useState("");
  const carregar = () => sel("SELECT id,nome,login,perfil,ativo FROM usuarios WHERE loja_id=$1 ORDER BY nome", [u.loja_id]).then(setL);
  useEffect(() => { carregar(); }, []);
  async function criar() {
    if (!f.nome.trim() || !f.login.trim() || f.senha.length < 4) { setAviso("Preencha nome, usuário e uma senha com 4 caracteres ou mais."); return; }
    try { await exe("INSERT INTO usuarios (loja_id,nome,login,senha_hash,perfil) VALUES ($1,$2,$3,$4,$5)", [u.loja_id, f.nome.trim(), f.login.trim().toLowerCase(), await sha256(f.senha), f.perfil]);
      setF({ nome: "", login: "", senha: "", perfil: "vendedor" }); setAviso("Usuário criado."); carregar(); } catch { setAviso("Esse usuário já existe."); }
  }
  async function alternar(x: any) { if (x.id === u.id) { setAviso("Você não pode desativar o próprio acesso."); return; } await exe("UPDATE usuarios SET ativo=$1 WHERE id=$2", [x.ativo ? 0 : 1, x.id]); carregar(); }
  async function trocar(x: any) { const s = window.prompt("Nova senha para " + x.nome + " (mínimo 4 caracteres):"); if (s && s.length >= 4) { await exe("UPDATE usuarios SET senha_hash=$1 WHERE id=$2", [await sha256(s), x.id]); setAviso("Senha alterada."); } }
  return (<div className="prod"><Aviso t={aviso} />
    <div className="cartao form"><h3>Novo usuário</h3><div className="grade">
      <label>Nome<input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></label>
      <label>Usuário<input value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} /></label>
      <label>Senha<input type="password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} /></label>
      <label>Perfil<select value={f.perfil} onChange={(e) => setF({ ...f, perfil: e.target.value as Perfil })}>
        <option value="gerente">Gerente</option><option value="vendedor">Vendedor</option><option value="caixa">Caixa</option><option value="estoque">Estoque</option></select></label></div>
      <div className="acoes"><button className="prim" onClick={criar}>Criar usuário</button></div></div>
    <table><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Situação</th><th /></tr></thead>
      <tbody>{l.map((x) => <tr key={x.id}><td>{x.nome}</td><td>{x.login}</td><td>{x.perfil}</td><td>{x.ativo ? "Ativo" : "Desativado"}</td>
        <td><button className="link" onClick={() => alternar(x)}>{x.ativo ? "Desativar" : "Reativar"}</button> <button className="link" onClick={() => trocar(x)}>Trocar senha</button></td></tr>)}</tbody></table></div>);
}
