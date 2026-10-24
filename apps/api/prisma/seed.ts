import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function resolveSqlFilePath(): string {
  const candidates = [
    path.resolve(__dirname, 'brewlite_database.sql'),
    path.resolve(__dirname, '../../brewlite_database.sql'),
    path.resolve(process.cwd(), 'prisma/brewlite_database.sql'),
    path.resolve(process.cwd(), '../../brewlite_database.sql'),
    path.resolve(process.cwd(), 'brewlite_database.sql'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Không tìm thấy file brewlite_database.sql');
}

function splitSqlStatements(sqlContent: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarBlock = false;
  let inSingleQuote = false;

  for (let i = 0; i < sqlContent.length; i++) {
    const ch = sqlContent[i];
    const next = sqlContent[i + 1];

    if (!inSingleQuote && ch === '$' && next === '$') {
      inDollarBlock = !inDollarBlock;
      current += '$$';
      i++;
      continue;
    }

    if (!inDollarBlock && ch === "'") {
      if (inSingleQuote && next === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (!inDollarBlock && !inSingleQuote && ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail.length > 0) {
    statements.push(tail);
  }
  return statements;
}

export async function runDatabaseSeed(client: PrismaClient): Promise<void> {
  const sqlPath = resolveSqlFilePath();
  const rawSql = fs.readFileSync(sqlPath, 'utf-8');
  const cleanSql = rawSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = splitSqlStatements(cleanSql);
  for (const stmt of statements) {
    await client.$executeRawUnsafe(stmt);
  }
}

if (require.main === module) {
  runDatabaseSeed(prisma)
    .then(() => {
      console.log('Đã thực thi brewlite_database.sql vào PostgreSQL thành công!');
    })
    .catch((err) => {
      console.error('Lỗi khi thực thi brewlite_database.sql:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
