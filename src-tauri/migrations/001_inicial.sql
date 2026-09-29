-- Toda tabela de negócio tem loja_id: pronto para multi-loja.
CREATE TABLE lojas (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, cnpj TEXT,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE licencas (          -- reservado para o licenciamento por loja
  id INTEGER PRIMARY KEY, loja_id INTEGER NOT NULL REFERENCES lojas(id),
  chave TEXT, validade TEXT, ativa INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY, loja_id INTEGER NOT NULL REFERENCES lojas(id),
  nome TEXT NOT NULL, login TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('gerente','vendedor','caixa','estoque')),
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE clientes (
  id INTEGER PRIMARY KEY, loja_id INTEGER NOT NULL REFERENCES lojas(id),
  nome TEXT NOT NULL, documento TEXT, telefone TEXT
);
CREATE TABLE fabricantes (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL UNIQUE
);
CREATE TABLE produtos (
  id INTEGER PRIMARY KEY, loja_id INTEGER NOT NULL REFERENCES lojas(id),
  fabricante_id INTEGER REFERENCES fabricantes(id), codigo TEXT NOT NULL,
  descricao TEXT NOT NULL, aplicacao TEXT,
  localizacao TEXT, custo REAL NOT NULL DEFAULT 0, preco REAL NOT NULL DEFAULT 0,
  estoque INTEGER NOT NULL DEFAULT 0, estoque_minimo INTEGER NOT NULL DEFAULT 0,
  UNIQUE (loja_id, fabricante_id, codigo)
);
CREATE TABLE movimentacoes (
  id INTEGER PRIMARY KEY, loja_id INTEGER NOT NULL REFERENCES lojas(id),
  produto_id INTEGER NOT NULL REFERENCES produtos(id), usuario_id INTEGER REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','venda','ajuste','devolucao')),
  quantidade INTEGER NOT NULL, origem TEXT, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY, loja_id INTEGER NOT NULL REFERENCES lojas(id),
  cliente_id INTEGER REFERENCES clientes(id), vendedor_id INTEGER NOT NULL REFERENCES usuarios(id),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','pago','cancelado')),
  total REAL NOT NULL DEFAULT 0, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE pedido_itens (
  id INTEGER PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  quantidade INTEGER NOT NULL, preco_unit REAL NOT NULL, desconto REAL NOT NULL DEFAULT 0
);
CREATE TABLE caixas (
  id INTEGER PRIMARY KEY, loja_id INTEGER NOT NULL REFERENCES lojas(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  aberto_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, fechado_em TEXT,
  valor_inicial REAL NOT NULL DEFAULT 0, valor_final REAL
);
CREATE TABLE pagamentos (
  id INTEGER PRIMARY KEY, pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  caixa_id INTEGER NOT NULL REFERENCES caixas(id),
  forma TEXT NOT NULL CHECK (forma IN ('dinheiro','pix','credito','debito')),
  valor REAL NOT NULL, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Dados iniciais (senha de todos: 1234, SHA-256)
INSERT INTO lojas (id, nome) VALUES (1, 'Loja Matriz');
INSERT INTO usuarios (loja_id, nome, login, senha_hash, perfil) VALUES
 (1,'Gerente','gerente','03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4','gerente'),
 (1,'Vendedor','vendedor','03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4','vendedor'),
 (1,'Caixa','caixa','03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4','caixa'),
 (1,'Estoque','estoque','03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4','estoque');

INSERT INTO fabricantes (nome) VALUES
 ('Cofap'),('SYL'),('Hipper Freios'),('Urba'),('Fremax'),
 ('IKS'),('Fania'),('NGK'),('Magneti Marelli Ignição');
