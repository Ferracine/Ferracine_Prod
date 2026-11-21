import { expect, test, type Page } from '@playwright/test';
import { DOWNLOAD_PREFIX, LATEST_RELEASE_API as API } from '../../src/domain/update';

const APK_URL = `${DOWNLOAD_PREFIX}v99.0.0/FerracineProd-99.0.0.apk`;

/** Simula o APK: a ponte do Android registra o pedido de atualização em window.__update. */
async function comoApk(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.FerracineAndroid = {
      savePdf: () => '',
      openPdf: () => '',
      sharePdf: () => '',
      setSystemBars: () => undefined,
      installUpdate: (url: string) => {
        w.__update = url;
        return '';
      },
    };
  });
}

function release(tag: string) {
  const v = tag.slice(1);
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    assets: [{ name: `FerracineProd-${v}.apk`, size: 600_000, browser_download_url: `${DOWNLOAD_PREFIX}${tag}/FerracineProd-${v}.apk` }],
  };
}

test('APK com versão nova no GitHub: aviso, Atualizar chama o Android e mostra o andamento', async ({ page }) => {
  await comoApk(page);
  await page.route(API, (route) => route.fulfill({ json: release('v99.0.0') }));
  await page.goto('/');

  const aviso = page.getByTestId('update-text');
  await expect(aviso).toContainText('Nova versão 99.0.0 disponível');
  await page.locator('#btn-update').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __update?: string }).__update)).toBe(APK_URL);
  await expect(aviso).toContainText('Baixando a versão 99.0.0');

  // Updater.kt avisando que precisa da permissão e depois que abriu o instalador.
  const status = (detail: object) => page.evaluate((d) => window.dispatchEvent(new CustomEvent('ferracine-update', { detail: d })), detail);
  await status({ status: 'permission' });
  await expect(aviso).toContainText('Instalar apps desconhecidos');
  await status({ status: 'installing' });
  await expect(aviso).toContainText('Confirme a instalação da versão 99.0.0');

  // "Agora não" some com o aviso sem atrapalhar o turno.
  await page.getByRole('button', { name: 'Agora não' }).click();
  await expect(page.locator('#update-banner')).toBeHidden();
});

test('"Procurar atualização" achando versão nova: o balão aparece no rodapé', async ({ page }) => {
  await comoApk(page);
  let resposta = release('v0.0.1'); // ao abrir: nada novo (o aviso do topo não aparece)
  await page.route(API, (route) => route.fulfill({ json: resposta }));
  await page.goto('/');
  await expect(page.locator('#update-banner')).toBeHidden();
  resposta = release('v99.0.0');
  await page.locator('#btn-check-update').click();
  const balao = page.locator('footer #update-banner');
  await expect(balao).toBeVisible();
  await expect(balao).toContainText('Nova versão 99.0.0 disponível');
  // Voltar ao app (consulta automática) não tira o balão do rodapé.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(balao).toBeVisible();
  await balao.locator('#btn-update').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __update?: string }).__update)).toBe(APK_URL);
  // Tocar de novo durante o download: avisa que já está baixando.
  await page.locator('#btn-check-update').click();
  await expect(page.getByRole('status').filter({ hasText: 'já está sendo baixada' })).toBeVisible();
});

test('APK já na versão mais recente: sem aviso; "Procurar atualização" confirma', async ({ page }) => {
  await comoApk(page);
  await page.route(API, (route) => route.fulfill({ json: release('v0.0.1') }));
  await page.goto('/');
  await expect(page.locator('#app-version')).toContainText('Versão ');
  await page.locator('#btn-check-update').click();
  await expect(page.getByRole('status').filter({ hasText: 'versão mais recente' })).toBeVisible();
  await expect(page.locator('#update-banner')).toBeHidden();
});

test('APK sem internet: "Procurar atualização" avisa e o app segue normal', async ({ page }) => {
  await comoApk(page);
  await page.route(API, (route) => route.abort('internetdisconnected'));
  await page.goto('/');
  await page.locator('#btn-check-update').click();
  await expect(page.getByRole('status').filter({ hasText: 'Sem internet' })).toBeVisible();
  await expect(page.getByLabel('Nome 1 *')).toBeVisible();
});

test('APK com o GitHub recusando (limite de consultas): avisa que o GitHub não respondeu, não "sem internet"', async ({ page }) => {
  await comoApk(page);
  await page.route(API, (route) => route.fulfill({ status: 403, json: { message: 'API rate limit exceeded' } }));
  await page.goto('/');
  await page.locator('#btn-check-update').click();
  await expect(page.getByRole('status').filter({ hasText: 'GitHub não respondeu' })).toBeVisible();
});

test('APK: tocar em "Procurar atualização" durante a consulta automática lenta ainda dá resposta', async ({ page }) => {
  await comoApk(page);
  let liberar = () => {};
  const lenta = new Promise<void>((r) => (liberar = r));
  let consultas = 0;
  await page.route(API, async (route) => {
    consultas++;
    await lenta; // sinal fraco: a consulta automática da abertura ainda não voltou
    await route.fulfill({ json: release('v0.0.1') });
  });
  await page.goto('/');
  await page.locator('#btn-check-update').click();
  // Carregando enquanto a consulta não volta.
  await expect(page.locator('#btn-check-update')).toContainText('Procurando...');
  await expect(page.locator('#btn-check-update')).toBeDisabled();
  liberar();
  await expect(page.getByRole('status').filter({ hasText: 'versão mais recente' })).toBeVisible();
  await expect(page.locator('#btn-check-update')).toHaveText('Procurar atualização');
  expect(consultas).toBe(1); // o toque esperou a mesma consulta em vez de abrir outra
});

test('navegador/PWA: mostra a versão, mas não procura APK (o service worker atualiza)', async ({ page }) => {
  let consultou = false;
  await page.route(API, (route) => {
    consultou = true;
    return route.fulfill({ json: release('v99.0.0') });
  });
  await page.goto('/');
  await expect(page.locator('#app-version')).toContainText('Versão ');
  await expect(page.locator('#btn-check-update')).toHaveCount(0);
  await expect(page.locator('#update-banner')).toBeHidden();
  expect(consultou).toBe(false);
});

test('cabeçalho do turno: grupos "Eletricista 1" e "Eletricista 2"', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Eletricista 1 (obrigatório)')).toBeVisible();
  await expect(page.getByText('Eletricista 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Integrante')).toHaveCount(0);
});
