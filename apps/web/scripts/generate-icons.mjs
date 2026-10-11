import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../assets/icons/marte.webp', import.meta.url));
const destination = new URL('../public/', import.meta.url);
const { width, height } = await sharp(source).metadata();
if (!width || !height || height < width) throw new Error('Expected portrait Marte artwork');

// The supplied reference shows the top square: hat, head, arm and coat.
// Crop the original pixels, without redrawing or stretching the artwork.
const crop = await sharp(source)
  .extract({ left: 0, top: 0, width, height: width })
  .flatten({ background: '#ffffff' })
  .png()
  .toBuffer();

for (const [name, size] of [
  ['apple-touch-icon-marte-v2.png', 180],
  ['icon-marte-v2-192.png', 192],
  ['icon-marte-v2-512.png', 512],
]) {
  await sharp(crop).resize(size, size).png()
    .toFile(fileURLToPath(new URL(name, destination)));
}

// Extra white margin gives Android masks room around the hat and face.
await sharp(crop).resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#ffffff' })
  .png().toFile(fileURLToPath(new URL('maskable-marte-v2-512.png', destination)));
