// Gera os ícones do APK a partir da prancheta (public/icon.png). Rode com `pnpm android:icons` após trocar o ícone.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const src = fileURLToPath(new URL('../public/icon.png', import.meta.url));
const res = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));

// Ícone clássico (48dp) e camada da frente do ícone adaptativo (108dp, com a figura nos 66% centrais).
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function iconOn(size, scale) {
  const inner = Math.round(size * scale);
  const pad = Math.floor((size - inner) / 2);
  return sharp(src)
    .resize(inner, inner, { fit: 'contain', background: transparent })
    .extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad, background: transparent })
    .png()
    .toBuffer();
}

for (const [name, k] of Object.entries(DENSITIES)) {
  const dir = `${res}mipmap-${name}/`;
  mkdirSync(dir, { recursive: true });
  const legacy = await iconOn(Math.round(48 * k), 0.92);
  writeFileSync(`${dir}ic_launcher.png`, legacy);
  writeFileSync(`${dir}ic_launcher_round.png`, legacy);
  writeFileSync(`${dir}ic_launcher_foreground.png`, await iconOn(Math.round(108 * k), 0.6));
}

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
mkdirSync(`${res}mipmap-anydpi-v26/`, { recursive: true });
writeFileSync(`${res}mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
writeFileSync(`${res}mipmap-anydpi-v26/ic_launcher_round.xml`, adaptive);
console.log('Ícones do APK gerados em android/app/src/main/res/mipmap-*');
