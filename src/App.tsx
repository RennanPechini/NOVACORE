import { useState } from "react";
import { entrar, Perfil, Usuario } from "./db";
import Produtos from "./Produtos";

const MODULOS: Record<Perfil, string[]> = {
  gerente: ["Painel", "Produtos", "Relatórios", "Preços e descontos", "Usuários", "Aprovações"],
  vendedor: ["Buscar peça", "Orçamentos", "Pedidos", "Clientes"],
  caixa: ["Caixa", "Receber pedido", "Sangria e troco", "Fechamento"],
  estoque: ["Produtos", "Entrada de nota", "Inventário", "Movimentações"],
};
const NOME_PERFIL: Record<Perfil, string> = {
  gerente: "Gerente", vendedor: "Vendedor", caixa: "Caixa", estoque: "Estoque",
};

function Login({ onOk }: { onOk: (u: Usuario) => void }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar() {
    setErro(""); setCarregando(true);
    try {
      const u = await entrar(login, senha);
      if (u) onOk(u); else setErro("Usuário ou senha incorretos. Confira e tente de novo.");
    } catch (e) {
      setErro("Não foi possível abrir o banco de dados: " + String(e));
    } finally { setCarregando(false); }
  }

  return (
    <div className="login">
      <div className="login-marca">
        <h1>Balcão</h1>
        <p>Gestão da loja de auto peças</p>
      </div>
      <div className="login-form">
        <label>Usuário
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus />
        </label>
        <label>Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar()} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button onClick={enviar} disabled={carregando}>{carregando ? "Entrando..." : "Entrar"}</button>
        <p className="dica">Acesso inicial: gerente, vendedor, caixa ou estoque. Senha 1234 (troque na etapa de usuários).</p>
      </div>
    </div>
  );
}

function Shell({ u, sair }: { u: Usuario; sair: () => void }) {
  const mods = MODULOS[u.perfil];
  const [ativo, setAtivo] = useState(mods[0]);
  return (
    <div className="shell">
      <aside>
        <div className="marca">Balcão</div>
        <nav>
          {mods.map((m) => (
            <button key={m} className={m === ativo ? "on" : ""} onClick={() => setAtivo(m)}>{m}</button>
          ))}
        </nav>
        <div className="user">
          <strong>{u.nome}</strong>
          <span>{NOME_PERFIL[u.perfil]} · loja {u.loja_id}</span>
          <button className="link" onClick={sair}>Sair</button>
        </div>
      </aside>
      <main>
        <h2>{ativo}</h2>
        {ativo === "Produtos" || ativo === "Buscar peça"
          ? <Produtos u={u} />
          : <p className="vazio">Este módulo entra nas próximas etapas.</p>}
      </main>
    </div>
  );
}

export default function App() {
  const [u, setU] = useState<Usuario | null>(null);
  return u ? <Shell u={u} sair={() => setU(null)} /> : <Login onOk={setU} />;
}
