// Ejecuta SQL en Supabase vía Management API.
// Uso: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/supabase-sql.mjs [archivo.sql]
// Sin archivo => lee SQL de stdin. Imprime status HTTP + respuesta JSON.
import { readFileSync } from "node:fs";

const tok = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!tok || !ref) {
  console.error("Faltan SUPABASE_ACCESS_TOKEN y/o SUPABASE_PROJECT_REF");
  process.exit(2);
}

const file = process.argv[2];
const sql = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${tok}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const text = await res.text();
console.log("HTTP", res.status);
if (process.env.SQL_OUT) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.SQL_OUT, text);
  console.log("respuesta completa escrita en", process.env.SQL_OUT, `(${text.length} bytes)`);
} else {
  console.log(text.slice(0, 6000));
}
process.exit(res.ok ? 0 : 1);
