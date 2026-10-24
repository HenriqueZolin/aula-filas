import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('ceps.db');
// Configura o journal_mode para WAL (Write-Ahead Logging)
db.exec('PRAGMA journal_mode = WAL;');
// Configura o busy_timeout para 5000 milissegundos (5 segundos)
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
  CREATE TABLE IF NOT EXISTS ceps (
    id            INTEGER PRIMARY KEY,
    cep           TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
    dados         TEXT,
    erro          TEXT,
    criado_em     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const inserir = db.prepare(`INSERT INTO ceps (cep) VALUES (?)`);
const buscar = db.prepare(`SELECT * FROM ceps where id = ?`);
const atualizar = db.prepare(`UPDATE ceps
    SET status = ?, dados = ?, erro = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ?`);

export function adicionarCep(cep) {
    return Number(inserir.run(cep).lastInsertRowid);
}

export function buscarCep(id) {
    const cep = buscar.get(id);
    if (cep?.dados){
        cep.dados = JSON.parse(cep.dados);
    }
    return cep;
}

export function atualizarCep(id, status, dados = null, erro = null){
    atualizar.run(status, dados && JSON.stringify(dados), erro, id);
}