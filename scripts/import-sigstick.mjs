import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';

// Sólo los cuatro packs elegidos por el usuario, en el orden del selector.
const packIds = ['tN55DFfHoIcgjLKDH8f0', 'VPyggyEYYzZwhGfRA97W', 'doIQC8s9O3wb3TJIwQMt', 'xqxHKQAnn0TxkX7zDhME'];
const root = resolve(import.meta.dirname, '..');
const destination = resolve(root, 'apps/web/src/assets/stickers/sigstick');
const staging = resolve(root, '.data/stickers-import');
const local = process.argv.includes('--local');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const headers = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.sigstick.com/', Origin: 'https://www.sigstick.com' };

async function download(url) {
  const parsed = new URL(url);
  const cachePath = parsed.origin === 'https://cdn2.cdnstep.com'
    ? resolve(staging, 'source', parsed.pathname.slice(1)) : undefined;
  if (cachePath) {
    try { return await readFile(cachePath); } catch { /* descarga inicial */ }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 15 * 1024 * 1024) throw new Error('Asset demasiado grande');
      if (cachePath) { await mkdir(resolve(cachePath, '..'), { recursive: true }); await writeFile(cachePath, bytes); }
      return bytes;
    } catch (error) {
      if (attempt === 2) throw new Error(`No se pudo descargar ${url}: ${error.message}`);
    }
  }
}

async function image(url, packId, name) {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://cdn2.cdnstep.com' || !parsed.pathname.startsWith(`/${packId}/`)) {
    throw new Error('Fuente de imagen fuera del pack esperado');
  }
  const source = await download(url);
  const metadata = await sharp(source, { animated: true, limitInputPixels: 128000000 }).metadata();
  if (!['png', 'gif', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) > 300) {
    throw new Error('Formato o número de cuadros inesperado');
  }
  // Los packs GIF publican archivos .png que en realidad contienen GIF.
  // Convertir todos sus cuadros a WebP transparente conservando tiempos y loop.
  let bytes = metadata.format === 'gif'
    ? await sharp(source, { animated: true, limitInputPixels: 128000000 }).webp({ lossless: true, effort: 4 }).toBuffer()
    : source;
  let output = await sharp(bytes, { animated: true }).metadata();
  if ((output.pages ?? 1) !== (metadata.pages ?? 1) ||
      JSON.stringify(output.delay) !== JSON.stringify(metadata.delay) || output.loop !== metadata.loop) {
    // Algunos GIF tienen tiempos que WebP normaliza. En ese caso conservar
    // los bytes GIF originales, con extensión real, sin perder cuadros/tiempos.
    bytes = source;
    output = metadata;
  }
  const filename = `${name}.${output.format}`;
  const path = `${packId}/${filename}`;
  await mkdir(resolve(staging, packId), { recursive: true });
  await writeFile(resolve(staging, path), bytes);
  return { path, sourceUrl: url, sourceFormat: metadata.format, sourceSha256: sha256(source),
    sha256: sha256(bytes), bytes: bytes.length, width: output.width, height: output.pageHeight ?? output.height,
    frames: output.pages ?? 1, loop: output.loop ?? null, hasAlpha: output.hasAlpha };
}

const packs = [];
if (local) {
  packs.push(...JSON.parse(await readFile(resolve(root, 'docs/sticker-packs.json'), 'utf8')).packs);
  if (JSON.stringify(packs.map((pack) => pack.id)) !== JSON.stringify(packIds)) throw new Error('El manifiesto no coincide con los cuatro packs elegidos');
}
for (const id of local ? [] : packIds) {
  const sourceUrl = `https://www.sigstick.com/pack/${id}`;
  const html = (await download(sourceUrl)).toString('utf8');
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) throw new Error('No se encontró el catálogo público');
  const pack = JSON.parse(match[1]).props.pageProps.pack;
  if (pack.id !== id || pack.status !== 'published' || !pack.stickers.length) throw new Error('Pack no disponible');
  const cover = await image(pack.cover.url, id, 'cover');
  const stickers = [];
  // Concurrencia limitada para descargar; conserva el orden original del pack.
  for (let offset = 0; offset < pack.stickers.length; offset += 4) {
    stickers.push(...await Promise.all(pack.stickers.slice(offset, offset + 4).map(async (sticker, j) => {
      const index = offset + j;
      const stem = new URL(sticker.url).pathname.split('/').at(-1).replace(/\.[^.]+$/, '');
      if (!/^\d+(?:-\d+)?$/.test(stem)) throw new Error('ID de imagen inesperado');
      const asset = await image(sticker.url, id, stem);
      return { id: `sigstick-${id}-${stem}`, label: `${pack.title} · ${sticker.emoji || 'Sticker'} ${index + 1}`,
        emoji: sticker.emoji, ...asset };
    })));
  }
  packs.push({ id, label: pack.title, sourceUrl, uploader: pack.author, cover, stickers });
  console.log(`${pack.title}: ${stickers.length} stickers, ${stickers.filter((s) => s.frames > 1).length} animados`);
}

// Preparar todo y comprobar IDs antes de escribir el catálogo. Nunca reemplazar
// los bytes de un ID existente: el historial ya enviado depende de ellos.
for (const pack of packs) {
  for (const asset of [pack.cover, ...pack.stickers]) {
    const path = resolve(destination, asset.path);
    let exists = false;
    try { await access(path); exists = true; } catch { /* archivo nuevo */ }
    if (exists && sha256(await readFile(path)) !== asset.sha256) throw new Error(`Asset existente cambió: ${asset.path}`);
  }
}
const imports = ["// Generado por scripts/import-sigstick.mjs; assets locales, sin peticiones a terceros.",
  "import type { ChatStickerPack } from './stickers';"];
const entries = [];
for (const [p, pack] of packs.entries()) {
  await mkdir(resolve(destination, pack.id), { recursive: true });
  for (const asset of [pack.cover, ...pack.stickers]) {
    const bytes = await readFile(resolve(local ? destination : staging, asset.path));
    await writeFile(resolve(destination, asset.path), bytes);
    // Miniatura estática: el selector carga pocos KB; preview y mensaje usan
    // siempre el archivo animado completo. No se pierde la animación enviada.
    const thumbnail = await sharp(bytes).resize({ width: 128, height: 128, fit: 'inside', withoutEnlargement: true }).webp({ lossless: true }).toBuffer();
    const path = asset.path.replace(/\.[^.]+$/, '.thumb.webp');
    await writeFile(resolve(destination, path), thumbnail);
    asset.thumbnail = { path, sha256: sha256(thumbnail), bytes: thumbnail.length };
  }
  imports.push(`import cover${p} from '../assets/stickers/sigstick/${pack.cover.thumbnail.path}?no-inline';`);
  const rows = pack.stickers.map((sticker, i) => {
    const variable = `pack${p}sticker${i}`;
    imports.push(`import ${variable} from '../assets/stickers/sigstick/${sticker.path}?no-inline';`);
    imports.push(`import ${variable}thumb from '../assets/stickers/sigstick/${sticker.thumbnail.path}?no-inline';`);
    return `    { id: ${JSON.stringify(sticker.id)}, label: ${JSON.stringify(sticker.label)}, src: ${variable}, thumbnailSrc: ${variable}thumb, body: ${JSON.stringify(`[sticker:chiikawa:${sticker.id}]`)} },`;
  });
  entries.push(`  { id: ${JSON.stringify(pack.id)}, label: ${JSON.stringify(pack.label)}, coverSrc: cover${p}, stickers: [\n${rows.join('\n')}\n  ] },`);
}
await writeFile(resolve(root, 'apps/web/src/lib/sigstick-packs.ts'), `${imports.join('\n')}\n\nexport const SIGSTICK_PACKS: readonly ChatStickerPack[] = [\n${entries.join('\n')}\n];\n`);
await writeFile(resolve(root, 'docs/sticker-packs.json'), JSON.stringify({ packs }, null, 2) + '\n');
console.log(`Catálogo listo: ${packs.reduce((n, pack) => n + pack.stickers.length, 0)} stickers nuevos.`);
