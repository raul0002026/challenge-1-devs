import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer } from './api/server';
import { createRepo, openDb, seedDemoData } from './db/index';

const dbPath = fileURLToPath(new URL('../data/app.db', import.meta.url));
mkdirSync(dirname(dbPath), { recursive: true });

const db = openDb(dbPath);
seedDemoData(createRepo(db));

const app = buildServer(db);
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

try {
  const address = await app.listen({ port, host });
  console.log(`API listening on ${address}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
