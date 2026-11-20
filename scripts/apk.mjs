// Monta o APK offline: copia o build web (dist/) para dentro do app Android e roda o Gradle.
// Uso: `pnpm apk` (faz o `vite build` antes). Saída: release/FerracineProd-<versão>.apk, assinado com a
// chave de C:\dev\.secrets (variáveis FERRACINE_PROD_* em C:\dev\.env).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isUnusedAsset } from './unused-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = `${root}dist`;
const www = `${root}android/app/src/main/assets/www`;
const version = JSON.parse(readFileSync(`${root}package.json`, 'utf8')).version;

if (!existsSync(`${dist}/index.html`)) throw new Error('dist/ vazio: rode `pnpm build` antes (ou use `pnpm apk`).');

// Fora do APK: o service worker (não roda lá; os arquivos já estão no pacote) e o que o app nunca carrega.
const serviceWorker = /[\\/](sw\.js|workbox-[^\\/]*\.js|manifest\.webmanifest)$/;
rmSync(www, { recursive: true, force: true });
cpSync(dist, www, { recursive: true, filter: (path) => !serviceWorker.test(path) && !isUnusedAsset(path) });

const javaHome = process.env.JAVA_HOME || (existsSync('C:/dev/jdk-17.0.2') ? 'C:/dev/jdk-17.0.2' : undefined);
const windows = process.platform === 'win32';
const gradlew = join(root, 'android', windows ? 'gradlew.bat' : 'gradlew');
const gradle = spawnSync(windows ? `"${gradlew}"` : gradlew, ['assembleRelease', '--console=plain'], {
  cwd: `${root}android`,
  stdio: 'inherit',
  shell: windows,
  env: { ...process.env, ...(javaHome ? { JAVA_HOME: javaHome } : {}) },
});
if (gradle.status !== 0) process.exit(gradle.status ?? 1);

const out = `${root}android/app/build/outputs/apk/release`;
if (!existsSync(`${out}/app-release.apk`)) {
  throw new Error('APK sem assinatura: configure FERRACINE_PROD_KEYSTORE_FILE/_PASSWORD e FERRACINE_PROD_KEY_ALIAS/_PASSWORD no C:/dev/.env (veja "APK" no README).');
}
mkdirSync(`${root}release`, { recursive: true });
const target = `${root}release/FerracineProd-${version}.apk`;
cpSync(`${out}/app-release.apk`, target);
console.log(`APK pronto: ${target}`);
