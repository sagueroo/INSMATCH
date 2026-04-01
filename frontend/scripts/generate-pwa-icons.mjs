/** Génère public/pwa-192.png et public/pwa-512.png — npm run pwa:icons */
import sharp from 'sharp';

const bg = { r: 0, g: 33, b: 87 };

for (const size of [192, 512]) {
  await sharp({
    create: { width: size, height: size, channels: 3, background: bg },
  })
    .png()
    .toFile(`public/pwa-${size}.png`);
  console.log(`public/pwa-${size}.png`);
}
