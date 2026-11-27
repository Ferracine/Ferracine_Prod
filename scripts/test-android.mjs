// Testes de unidade do lado Kotlin (android/app/src/test: regras do atualizador), com o JDK 17 de C:\dev se o
// JAVA_HOME não estiver definido (mesma regra do scripts/apk.mjs).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const javaHome = process.env.JAVA_HOME || (existsSync('C:/dev/jdk-17.0.2') ? 'C:/dev/jdk-17.0.2' : undefined);
const windows = process.platform === 'win32';
const gradlew = join(root, 'android', windows ? 'gradlew.bat' : 'gradlew');
const r = spawnSync(windows ? `"${gradlew}"` : gradlew, [':app:testDebugUnitTest', '--console=plain', '-q'], {
  cwd: join(root, 'android'),
  stdio: 'inherit',
  shell: windows,
  env: { ...process.env, ...(javaHome ? { JAVA_HOME: javaHome } : {}) },
});
if (r.status === 0) console.log('Testes Kotlin (android/app/src/test): ok');
process.exit(r.status ?? 1);
