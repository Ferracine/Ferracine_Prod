// Publica uma versão nova completa em um comando só:
// 1. Sobe a versão no package.json (patch por padrão, se a versão atual já tiver tag v<versão>);
// 2. Roda `pnpm check` (tsc + vitest + vite build + playwright e2e);
// 3. Gera o APK assinado (`node scripts/apk.mjs` -> release/FerracineProd-<versão>.apk);
// 4. Cria o commit, faz `git push origin main` (dispara o GitHub Pages);
// 5. Publica a Release no GitHub com o APK anexado (`gh release create v<versão>`).
//
// Uso:
//   pnpm release                        # sobe patch (ex.: 1.4.17 -> 1.4.18)
//   pnpm release "texto da mudança"     # sobe patch e usa o texto no commit/Release
//   pnpm release minor "texto"          # sobe minor (ex.: 1.4.17 -> 1.5.0)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkgPath = `${root}package.json`;
const windows = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: windows, ...opts });
  if (res.status !== 0) {
    const err = new Error(`Comando falhou (${cmd} ${args.join(' ')})`);
    err.exitCode = res.status ?? 1;
    throw err;
  }
}

function capture(cmd, args) {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8' }).trim();
}

function tagExists(tag) {
  const local = spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: root, stdio: 'ignore' });
  if (local.status === 0) return true;
  const remote = spawnSync('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`], { cwd: root, encoding: 'utf8' });
  return Boolean(remote.stdout?.trim());
}

function bumpVersion(ver, kind) {
  const parts = ver.split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) throw new Error(`Versão inválida no package.json: ${ver}`);
  const [maj, min, pat] = parts;
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

// Só no main e com a árvore limpa: o commit da release leva só o package.json, e a tag/Release apontam para o main.
const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') {
  console.error(`pnpm release só roda no main (branch atual: ${branch}).`);
  process.exit(1);
}
if (capture('git', ['status', '--porcelain'])) {
  console.error('pnpm release precisa da árvore limpa: faça commit (ou guarde) as mudanças antes.');
  process.exit(1);
}

const args = process.argv.slice(2);
const bumpKind = ['patch', 'minor', 'major'].includes(args[0]) ? args.shift() : null;
const customMsg = args.join(' ').trim();

const pkgRaw = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgRaw);
const oldVersion = pkg.version;

// Se o usuário pediu bump explícito (patch/minor/major) ou se a versão atual já foi lançada (tag v<versão> existe),
// incrementa a versão automaticamente.
const nextVersion = bumpKind || tagExists(`v${oldVersion}`) ? bumpVersion(oldVersion, bumpKind ?? 'patch') : oldVersion;
const tag = `v${nextVersion}`;

if (nextVersion !== oldVersion) {
  const updated = pkgRaw.replace(`"version": "${oldVersion}"`, `"version": "${nextVersion}"`);
  writeFileSync(pkgPath, updated, 'utf8');
  console.log(`Versão atualizada no package.json: ${oldVersion} -> ${nextVersion}`);
} else {
  console.log(`Usando versão já definida no package.json: ${nextVersion}`);
}

try {
  console.log('\n[1/4] Validando projeto (pnpm check: lint + unit + build + e2e)...');
  run('pnpm', ['check']);

  console.log('\n[2/4] Montando APK assinado (scripts/apk.mjs)...');
  run('node', ['scripts/apk.mjs']);
} catch (err) {
  if (nextVersion !== oldVersion) {
    writeFileSync(pkgPath, pkgRaw, 'utf8');
    console.error(`Falha na validação/build: package.json restaurado para ${oldVersion}.`);
  }
  process.exit(err.exitCode ?? 1);
}

const apkPath = `release/FerracineProd-${nextVersion}.apk`;
if (!existsSync(`${root}${apkPath}`)) {
  if (nextVersion !== oldVersion) writeFileSync(pkgPath, pkgRaw, 'utf8');
  throw new Error(`APK não encontrado em ${apkPath}`);
}

console.log('\n[3/4] Commitando e enviando para o GitHub (main -> GitHub Pages)...');
if (nextVersion !== oldVersion) {
  run('git', ['add', 'package.json']);
  const commitTitle = customMsg ? `release(${tag}): ${customMsg}` : `chore(release): ${tag}`;
  const commitRes = spawnSync('git', ['commit', '-m', commitTitle], { cwd: root, stdio: 'inherit' });
  if (commitRes.status !== 0) {
    spawnSync('git', ['reset', '-q', 'package.json'], { cwd: root });
    writeFileSync(pkgPath, pkgRaw, 'utf8');
    console.error(`Commit falhou: package.json restaurado para ${oldVersion}.`);
    process.exit(commitRes.status ?? 1);
  }
}
run('git', ['push', 'origin', 'main']);

console.log(`\n[4/4] Publicando Release ${tag} com ${apkPath}...`);
const notes = customMsg || `Versão ${nextVersion}`;
const ghRes = spawnSync(
  'gh',
  ['release', 'create', tag, apkPath, '-R', 'Ferracine/Ferracine_Prod', '--target', 'main', '--title', tag, '--notes', notes],
  { cwd: root, stdio: 'inherit' },
);
if (ghRes.status !== 0) process.exit(ghRes.status ?? 1);

console.log(`\nLançamento ${tag} concluído! APK publicado na Release e deploy do GitHub Pages iniciado.`);
