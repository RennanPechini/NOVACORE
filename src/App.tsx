import { useState } from "react";
import { entrar, Perfil, Usuario } from "./db";
import Produtos from "./Produtos";
import { Caixa, Entrada, Movimentacoes, Painel, Pedidos, Usuarios } from "./Operacoes";

const MODULOS: Record<Perfil, string[]> = {
  gerente: ["Painel", "Produtos", "Pedidos", "Movimentações", "Usuários"],
  vendedor: ["Buscar peça", "Pedidos"],
  caixa: ["Caixa"],
  estoque: ["Produtos", "Entrada de nota", "Movimentações"],
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
        <h1>NOVACORE</h1>
        <p>Gestão para lojas de auto peças</p>
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
        <p className="dica">Acesso inicial: gerente, vendedor, caixa ou estoque. Senha 1234 (troque em Usuários).</p>
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
        <div className="marca">NOVACORE</div>
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
        {ativo === "Produtos" || ativo === "Buscar peça" ? <Produtos u={u} />
          : ativo === "Pedidos" ? <Pedidos u={u} />
          : ativo === "Caixa" ? <Caixa u={u} />
          : ativo === "Entrada de nota" ? <Entrada u={u} />
          : ativo === "Movimentações" ? <Movimentacoes u={u} />
          : ativo === "Painel" ? <Painel u={u} />
          : <Usuarios u={u} />}
      </main>
    </div>
  );
}

export default function App() {
  const [u, setU] = useState<Usuario | null>(null);
  return u ? <Shell u={u} sair={() => setU(null)} /> : <Login onOk={setU} />;
}
