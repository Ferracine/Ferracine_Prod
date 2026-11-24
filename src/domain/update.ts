/**
 * Atualização do APK pelas Releases do GitHub (regras puras; a rede fica em src/update.ts e o download e a
 * instalação em android/.../Updater.kt). Só uma Release publicada, com o APK anexado e versão maior que a
 * instalada, vira atualização.
 */

const REPO = 'Ferracine/Ferracine_Prod';
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
/** O APK só é baixado deste endereço (o Updater.kt confere o mesmo prefixo). */
export const DOWNLOAD_PREFIX = `https://github.com/${REPO}/releases/download/`;

export interface UpdateInfo {
  version: string;
  url: string;
  /** Tamanho do APK em bytes. */
  size: number;
}

/**
 * Minor e patch até 99: o versionCode do APK é major·10000 + minor·100 + patch, e acima disso duas versões teriam o
 * mesmo código (o Android recusaria a "atualização" sempre).
 */
function parts(v: string): number[] | null {
  const m = /^v?(\d+)\.(\d{1,2})\.(\d{1,2})$/.exec(v.trim());
  return m ? m.slice(1).map(Number) : null;
}

/** true se `candidate` (ex.: "v1.3.0") for maior que `current` (ex.: "1.2.1"). Versão fora do padrão nunca é maior. */
export function isNewer(candidate: string, current: string): boolean {
  const a = parts(candidate);
  const b = parts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

interface ReleaseAsset {
  name?: unknown;
  size?: unknown;
  browser_download_url?: unknown;
}

/** Resposta de releases/latest → atualização disponível, ou null (nada novo, rascunho, sem APK ou resposta estranha). */
export function pickUpdate(release: unknown, current: string): UpdateInfo | null {
  if (!release || typeof release !== 'object') return null;
  const r = release as { tag_name?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown };
  if (typeof r.tag_name !== 'string' || r.draft === true || r.prerelease === true) return null;
  if (!isNewer(r.tag_name, current) || !Array.isArray(r.assets)) return null;
  // Só o APK da própria versão da Release (um APK antigo esquecido na Release instalaria a versão errada).
  const tag = r.tag_name.trim();
  const version = tag.replace(/^v/, '');
  const name = `FerracineProd-${version}.apk`;
  const url = `${DOWNLOAD_PREFIX}${tag}/${name}`;
  const apk = (r.assets as ReleaseAsset[]).find((a) => a.name === name && a.browser_download_url === url);
  if (!apk) return null;
  return { version, url, size: typeof apk.size === 'number' && apk.size > 0 ? apk.size : 0 };
}
