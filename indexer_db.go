package main

import (
	"crypto/sha1"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// indexer_db.go contém a camada de persistência do indexador. Usamos
// modernc.org/sqlite (puro Go) pra não conflitar com o CGO do webkit2gtk
// e simplificar a cross-compile pro Windows. Cada workspace ganha seu
// próprio banco em ~/.cache/adila/<sha1(workdir)>/symbols.db.

// indexerSchema é executado idempotentemente em toda abertura do banco.
// `journal_mode=WAL` permite leitura concorrente enquanto a goroutine de
// indexação escreve.
const indexerSchema = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS files (
    id      INTEGER PRIMARY KEY,
    path    TEXT NOT NULL UNIQUE,
    mtime   INTEGER NOT NULL,
    size    INTEGER NOT NULL,
    lang    TEXT NOT NULL,
    hash    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symbols (
    id        INTEGER PRIMARY KEY,
    file_id   INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    kind      TEXT NOT NULL,
    scope     TEXT,
    line      INTEGER NOT NULL,
    col       INTEGER NOT NULL,
    end_line  INTEGER NOT NULL,
    signature TEXT
);

CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
`

// indexerDB encapsula o sql.DB e o caminho onde ele vive — útil pro frontend
// exibir "Índice em /home/.../symbols.db" ou pra deletar via Reindex.
type indexerDB struct {
	db   *sql.DB
	path string
}

// openIndexerDB resolve o caminho a partir do workdir, garante o diretório,
// abre/cria o banco e roda o schema. workspaceHashFromPath é estável: o
// mesmo workdir produz o mesmo hash entre execuções.
func openIndexerDB(workdir string) (*indexerDB, error) {
	if workdir == "" {
		return nil, errors.New("workdir vazio")
	}
	abs, err := filepath.Abs(workdir)
	if err != nil {
		return nil, err
	}
	cacheDir, err := userCacheRoot()
	if err != nil {
		return nil, err
	}
	dbDir := filepath.Join(cacheDir, "adila", "indexer", workspaceHashFromPath(abs))
	if err := os.MkdirAll(dbDir, 0o755); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dbDir, "symbols.db")
	// _txlock=immediate força o sqlite a fazer reserva de lock no BEGIN, o que
	// elimina condições de corrida quando vários workers de indexação tentam
	// gravar transações pequenas em paralelo.
	dsn := fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=foreign_keys(on)&_txlock=immediate", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// Limita o pool a 1 escritor + N leitores. Sqlite serializa escritas
	// independente disso, mas SetMaxOpenConns alto cria ruído de "database is
	// locked" sob carga; deixar baixo é mais previsível.
	db.SetMaxOpenConns(4)
	if _, err := db.Exec(indexerSchema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("schema: %w", err)
	}
	return &indexerDB{db: db, path: dbPath}, nil
}

func (d *indexerDB) Close() error {
	if d == nil || d.db == nil {
		return nil
	}
	return d.db.Close()
}

// fileRecord representa um row da tabela files; só precisamos do hash e mtime
// pra decidir se vale re-parsear o arquivo.
type fileRecord struct {
	id    int64
	hash  string
	mtime int64
}

// getFile devolve nil sem erro quando o arquivo ainda não está indexado.
func (d *indexerDB) getFile(path string) (*fileRecord, error) {
	row := d.db.QueryRow(`SELECT id, hash, mtime FROM files WHERE path = ?`, path)
	var r fileRecord
	if err := row.Scan(&r.id, &r.hash, &r.mtime); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &r, nil
}

// upsertFileWithSymbols substitui atomicamente os símbolos de um arquivo.
// Usar uma transação por arquivo é mais lento que batch, mas mantém o estado
// consistente caso o app caia no meio da indexação inicial.
func (d *indexerDB) upsertFileWithSymbols(path, lang, hash string, mtime, size int64, syms []Symbol) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// QueryRow + RETURNING é o caminho oficial do modernc.org/sqlite pra
	// pegar o id da linha afetada por um upsert atômico.
	var fileID int64
	err = tx.QueryRow(`
        INSERT INTO files (path, mtime, size, lang, hash)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
            mtime = excluded.mtime,
            size  = excluded.size,
            lang  = excluded.lang,
            hash  = excluded.hash
        RETURNING id`,
		path, mtime, size, lang, hash).Scan(&fileID)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(`DELETE FROM symbols WHERE file_id = ?`, fileID); err != nil {
		return err
	}
	if len(syms) > 0 {
		stmt, err := tx.Prepare(`
            INSERT INTO symbols (file_id, name, kind, scope, line, col, end_line, signature)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, s := range syms {
			if _, err := stmt.Exec(fileID, s.Name, s.Kind, s.Scope, s.Line, s.Col, s.EndLine, s.Signature); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

// removeFile é chamado quando o watcher detecta unlink. ON DELETE CASCADE
// limpa os símbolos automaticamente.
func (d *indexerDB) removeFile(path string) error {
	_, err := d.db.Exec(`DELETE FROM files WHERE path = ?`, path)
	return err
}

// searchSymbols faz match case-insensitive por substring no nome. Para o MVP
// é suficiente — fuzzy de qualidade pode entrar numa fase posterior usando
// FTS5 ou ranking custom.
func (d *indexerDB) searchSymbols(query string, limit int) ([]Symbol, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	q := "%" + query + "%"
	rows, err := d.db.Query(`
        SELECT s.name, s.kind, COALESCE(s.scope, ''), f.path,
               s.line, s.col, COALESCE(s.signature, '')
          FROM symbols s
          JOIN files f ON f.id = s.file_id
         WHERE s.name LIKE ? COLLATE NOCASE
         ORDER BY length(s.name) ASC, s.name COLLATE NOCASE ASC
         LIMIT ?`, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Symbol, 0, limit)
	for rows.Next() {
		var s Symbol
		if err := rows.Scan(&s.Name, &s.Kind, &s.Scope, &s.Path, &s.Line, &s.Col, &s.Signature); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// symbolsForFile lista todos os símbolos extraídos de um único arquivo,
// usado pelo painel de outline (futuro) e pra diagnostics.
func (d *indexerDB) symbolsForFile(path string) ([]Symbol, error) {
	rows, err := d.db.Query(`
        SELECT s.name, s.kind, COALESCE(s.scope, ''), f.path,
               s.line, s.col, COALESCE(s.signature, '')
          FROM symbols s
          JOIN files f ON f.id = s.file_id
         WHERE f.path = ?
         ORDER BY s.line ASC`, path)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Symbol, 0, 64)
	for rows.Next() {
		var s Symbol
		if err := rows.Scan(&s.Name, &s.Kind, &s.Scope, &s.Path, &s.Line, &s.Col, &s.Signature); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// countFiles informa quantos arquivos já estão indexados — exibido na status
// bar como denominador do progresso.
func (d *indexerDB) countFiles() (int, error) {
	row := d.db.QueryRow(`SELECT COUNT(*) FROM files`)
	var n int
	return n, row.Scan(&n)
}

// resetAll limpa o banco mantendo o schema. Usado pelo Reindex().
func (d *indexerDB) resetAll() error {
	_, err := d.db.Exec(`DELETE FROM files`)
	return err
}

// allFilePaths devolve todos os paths conhecidos pelo DB. Usado pelo
// incrementalSync pra detectar arquivos que foram removidos do disco.
func (d *indexerDB) allFilePaths() ([]string, error) {
	rows, err := d.db.Query(`SELECT path FROM files`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0, 256)
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ── helpers ──────────────────────────────────────────────────────────────

// userCacheRoot devolve $XDG_CACHE_HOME ou ~/.cache no Linux. No Windows o
// os.UserCacheDir aponta pra %LocalAppData%, o que também serve.
func userCacheRoot() (string, error) {
	return os.UserCacheDir()
}

// workspaceHashFromPath produz um identificador estável de 12 chars pro
// caminho do workspace. SHA1 é mais que suficiente pra evitar colisão
// prática entre projetos do usuário; tamanho reduzido só pra deixar o path
// do cache mais curto.
func workspaceHashFromPath(abs string) string {
	sum := sha1.Sum([]byte(abs))
	return hex.EncodeToString(sum[:])[:12]
}
