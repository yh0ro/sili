import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// The world uses the same transactional SQL contract on D1 and Render SQLite.
export function openSQLite(path, migrations = resolve('drizzle')) {
 mkdirSync(dirname(resolve(path)), { recursive: true });
 const connection = new DatabaseSync(path);
 connection.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 connection.exec('CREATE TABLE IF NOT EXISTS silicon_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL)');
 try {
  connection.exec('BEGIN IMMEDIATE');
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
   const sql = readFileSync(resolve(migrations, name), 'utf8');
   const hash = createHash('sha256').update(sql).digest('hex');
   const applied = connection.prepare('SELECT hash FROM silicon_migrations WHERE name=?').get(name);
   if (applied) {
    if (applied.hash !== hash) throw new Error(`Applied migration changed: ${name}`);
    continue;
   }
   connection.exec(sql);
   connection.prepare('INSERT INTO silicon_migrations(name,hash) VALUES(?,?)').run(name, hash);
  }
  connection.exec('COMMIT');
 } catch (error) { connection.exec('ROLLBACK'); connection.close(); throw error; }

 class Statement {
  constructor(sql, values = []) { this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.sql, values); }
  execute() {
   const statement = connection.prepare(this.sql);
   if (statement.columns().length) {
    const results = statement.all(...this.values);
    const changes = connection.prepare('SELECT changes() AS n').get().n;
    return { results, success: true, meta: { changes: Number(changes) } };
   }
   const result = statement.run(...this.values);
   return { results: [], success: true, meta: { changes: Number(result.changes) } };
  }
  async all() { return this.execute(); }
  async run() { return this.execute(); }
  async first(column) {
   const row = connection.prepare(this.sql).get(...this.values);
   return row ? (column ? row[column] : row) : null;
  }
 }
 return {
  prepare(sql) { return new Statement(sql); },
  async batch(statements) {
   connection.exec('BEGIN IMMEDIATE');
   try { const results = statements.map(statement => statement.execute()); connection.exec('COMMIT'); return results; }
   catch (error) { connection.exec('ROLLBACK'); throw error; }
  },
  close() { connection.close(); },
 };
}

let database;
export function getSQLiteDatabase() {
 if (!process.env.SQLITE_PATH) throw new Error('SQLITE_PATH must point to persistent storage.');
 return database ??= openSQLite(process.env.SQLITE_PATH);
}
