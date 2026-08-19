import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const directory = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(directory)).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort();
if (!files.length) throw new Error("Nenhuma migration Supabase foi encontrada.");
const destructive = [];
for (const file of files) {
  const sql = await readFile(join(directory, file), "utf8");
  const operations = [...sql.matchAll(/^\s*(drop\s+(?!policy|trigger|constraint|function)|truncate\b|delete\s+from\b|alter\s+table[^;]+drop\s+column)/gim)].map((match) => match[0].trim().replace(/\s+/g, " "));
  if (operations.length) destructive.push({ file, operations });
}
console.log(JSON.stringify({ migrations: files.length, ordered: files, destructive }, null, 2));
if (destructive.length) {
  console.error("Auditoria interrompida: operações destrutivas de dados/schema exigem revisão manual.");
  process.exit(2);
}
