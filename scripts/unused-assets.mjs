// Arquivos do build que o app nunca carrega. Uma lista só para o cache offline do PWA (vite.config.ts,
// globIgnores) e para o APK (scripts/apk.mjs).
export const UNUSED_ASSET_GLOBS = [
  // A Inter traz vários alfabetos; o app só usa o latino.
  '**/*cyrillic*',
  '**/*greek*',
  '**/*vietnamese*',
  // Dependências opcionais do jsPDF (doc.html() e SVG), que o app não usa.
  '**/html2canvas-*.js',
  '**/purify.es-*.js',
  '**/index.es-*.js',
];

/** Os mesmos padrões como teste de nome de arquivo (para cópias fora do Vite). */
export function isUnusedAsset(path) {
  const name = path.replace(/\\/g, '/').split('/').pop() ?? '';
  return /cyrillic|greek|vietnamese/.test(name) || /^(html2canvas|purify\.es|index\.es)-.*\.js$/.test(name);
}
