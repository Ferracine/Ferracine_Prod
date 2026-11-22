import { describe, expect, it } from 'vitest';
import { DOWNLOAD_PREFIX, isNewer, pickUpdate } from '../../src/domain/update';

describe('isNewer', () => {
  it('compara major, minor e patch como números (não como texto)', () => {
    expect(isNewer('v1.3.0', '1.2.1')).toBe(true);
    expect(isNewer('v1.4.10', '1.4.9')).toBe(true); // número, não texto ("10" < "9" como texto)
    expect(isNewer('1.2.10', '1.2.9')).toBe(true);
    expect(isNewer('2.0.0', '1.99.99')).toBe(true);
    expect(isNewer('v1.2.1', '1.2.1')).toBe(false);
    expect(isNewer('1.2.0', '1.2.1')).toBe(false);
  });

  it('versão fora do padrão nunca é tratada como nova', () => {
    expect(isNewer('latest', '1.2.1')).toBe(false);
    expect(isNewer('v1.3', '1.2.1')).toBe(false);
    expect(isNewer('v1.3.0-beta', '1.2.1')).toBe(false);
    // minor/patch acima de 99 teriam o mesmo versionCode de outra versão (1.2.100 = 1.3.0)
    expect(isNewer('1.2.100', '1.2.1')).toBe(false);
  });
});

const apk = (version: string) => ({
  name: `FerracineProd-${version}.apk`,
  size: 584941,
  browser_download_url: `${DOWNLOAD_PREFIX}v${version}/FerracineProd-${version}.apk`,
});

describe('pickUpdate', () => {
  it('Release mais nova com o APK anexado vira atualização', () => {
    const r = { tag_name: 'v1.3.0', draft: false, prerelease: false, assets: [{ name: 'notas.txt', size: 1, browser_download_url: `${DOWNLOAD_PREFIX}v1.3.0/notas.txt` }, apk('1.3.0')] };
    expect(pickUpdate(r, '1.2.1')).toEqual({ version: '1.3.0', url: `${DOWNLOAD_PREFIX}v1.3.0/FerracineProd-1.3.0.apk`, size: 584941 });
  });

  it('nada a fazer: mesma versão, mais antiga, rascunho, pré-lançamento ou sem APK', () => {
    expect(pickUpdate({ tag_name: 'v1.2.1', assets: [apk('1.2.1')] }, '1.2.1')).toBeNull();
    expect(pickUpdate({ tag_name: 'v1.2.0', assets: [apk('1.2.0')] }, '1.2.1')).toBeNull();
    expect(pickUpdate({ tag_name: 'v1.3.0', draft: true, assets: [apk('1.3.0')] }, '1.2.1')).toBeNull();
    expect(pickUpdate({ tag_name: 'v1.3.0', prerelease: true, assets: [apk('1.3.0')] }, '1.2.1')).toBeNull();
    expect(pickUpdate({ tag_name: 'v1.3.0', assets: [] }, '1.2.1')).toBeNull();
  });

  it('APK de outra versão anexado à Release é ignorado (instalaria a versão errada)', () => {
    expect(pickUpdate({ tag_name: 'v1.4.0', assets: [apk('1.3.0')] }, '1.2.1')).toBeNull();
    expect(pickUpdate({ tag_name: 'v1.4.0', assets: [apk('1.3.0'), apk('1.4.0')] }, '1.2.1')?.version).toBe('1.4.0');
  });

  it('APK fora do repositório do app é ignorado', () => {
    const fora = { ...apk('1.3.0'), browser_download_url: 'https://exemplo.com/FerracineProd-1.3.0.apk' };
    expect(pickUpdate({ tag_name: 'v1.3.0', assets: [fora] }, '1.2.1')).toBeNull();
  });

  it('resposta inesperada (erro da API, limite de consultas) não quebra', () => {
    expect(pickUpdate(null, '1.2.1')).toBeNull();
    expect(pickUpdate({ message: 'API rate limit exceeded' }, '1.2.1')).toBeNull();
    expect(pickUpdate('texto', '1.2.1')).toBeNull();
  });
});
