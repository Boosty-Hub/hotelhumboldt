// Supabase Storage (solo servidor) vía REST con la service_role key.
// NUNCA exponer SUPABASE_SERVICE_ROLE_KEY al cliente: solo se importa desde
// server actions / route handlers. La key NO es NEXT_PUBLIC, así que nunca
// llega al bundle del navegador.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const ATTACHMENT_BUCKET = "adjuntos";

function cfg() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Almacenamiento no configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  return { url: SUPABASE_URL, key: SERVICE_KEY };
}

/** Sube bytes al bucket. path = clave dentro del bucket (ej. "oppId/uid-archivo.pdf"). */
export async function uploadToBucket(
  path: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string
): Promise<void> {
  const { url, key } = cfg();
  const res = await fetch(
    `${url}/storage/v1/object/${ATTACHMENT_BUCKET}/${encodeURI(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": contentType || "application/octet-stream",
        "x-upsert": "false",
      },
      body: body as BodyInit,
    }
  );
  if (!res.ok) {
    throw new Error(`No se pudo subir el archivo (${res.status}): ${await res.text()}`);
  }
}

/** URL firmada temporal para descargar/ver un objeto privado.
 *  Si se pasa fileName, fuerza la descarga (Content-Disposition: attachment) para
 *  que tipos peligrosos (SVG/HTML) no se rendericen inline en el navegador. */
export async function createSignedUrl(
  path: string,
  expiresIn = 120,
  fileName?: string
): Promise<string> {
  const { url, key } = cfg();
  const res = await fetch(
    `${url}/storage/v1/object/sign/${ATTACHMENT_BUCKET}/${encodeURI(path)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    }
  );
  if (!res.ok) throw new Error(`No se pudo firmar la URL (${res.status}).`);
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL ?? data.signedUrl ?? "";
  const download = fileName ? `&download=${encodeURIComponent(fileName)}` : "";
  return `${url}/storage/v1${signed}${download}`;
}

/** Borra un objeto del bucket (best-effort: no lanza si ya no existe). */
export async function removeFromBucket(path: string): Promise<void> {
  const { url, key } = cfg();
  await fetch(`${url}/storage/v1/object/${ATTACHMENT_BUCKET}/${encodeURI(path)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  }).catch(() => {});
}
