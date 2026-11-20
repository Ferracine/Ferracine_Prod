// Gera o PNG do logo usado no PDF (o jsPDF não desenha SVG). Rode com `pnpm logo` após trocar src/assets/energisa.svg.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const src = fileURLToPath(new URL('../src/assets/energisa.svg', import.meta.url));
const out = fileURLToPath(new URL('../src/assets/energisa-pdf.png', import.meta.url));

// 600 px de largura: ~400 dpi no tamanho do PDF (~37 mm), nítido na impressão sem pesar no app.
await sharp(src, { density: 600 })
  .trim()
  .resize({ width: 600 })
  .flatten({ background: '#ffffff' })
  .png({ compressionLevel: 9, palette: true })
  .toFile(out);

console.log('Logo do PDF gerado em src/assets/energisa-pdf.png');
