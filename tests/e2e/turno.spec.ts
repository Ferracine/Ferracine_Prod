import { expect, test, type Page } from '@playwright/test';

async function iniciarTurno(page: Page) {
  await page.goto('/');
  await page.getByLabel('Nome 1 *').fill('João da Silva');
  await page.getByLabel('Mat. 1 *').fill('123456');
  await page.getByLabel('Início *').fill('07:00');
  await page.getByLabel('Fim *').fill('17:00');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
}

async function abrirOS(page: Page, numero: string, codigo: string) {
  await page.locator('#input-os-number').fill(numero);
  await page.locator(`[data-code="${codigo}"]`).click();
  await expect(page.locator('#screen-wizard')).toBeVisible();
}

const proximo = (page: Page) => page.locator('#btn-wiz-next').click();
const pular = (page: Page) => page.locator('#btn-wiz-skip').click();

test('turno completo: cabeçalho, OS comercial, OS de ocorrência com DITAIS e PDF', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.getByRole('alert')).toContainText('Preencha Nome 1');

  await iniciarTurno(page);
  await expect(page.getByText('João da Silva (Mat: 123456)')).toBeVisible();

  // Código sem número de OS
  await page.locator('[data-code="709"]').click();
  await expect(page.getByRole('status').last()).toContainText('Digite o número da OS');

  // Comercial: 3 perguntas
  await abrirOS(page, '123', '709');
  await expect(page.locator('#wiz-step-label')).toHaveText('Pergunta 1 de 3');
  await proximo(page);
  await expect(page.getByRole('status').last()).toContainText('Digite uma resposta');
  await page.locator('#wiz-text-input').fill('Ligação nova');
  await page.locator('#wiz-text-input').press('Enter');
  await page.locator('[data-choice="Sim"]').click();
  await proximo(page);
  await expect(page.locator('#btn-wiz-next')).toHaveText(/Concluir OS/);
  await pular(page);
  await expect(page.getByTestId('os-item')).toHaveCount(1);

  // Ocorrência: OS pré-preenchida e DITAIS obrigatória
  await abrirOS(page, '456', '508');
  await pular(page);
  await expect(page.locator('#wiz-text-input')).toHaveValue('456');
  await proximo(page);
  for (let i = 0; i < 3; i++) await pular(page);
  await expect(page.locator('#wiz-question-text')).toHaveText('Houve necessidade de realizar os DITAIS?');
  await expect(page.locator('#wiz-mandatory-alert')).toBeVisible();
  await expect(page.locator('#btn-wiz-skip')).toHaveCount(0);
  await proximo(page);
  await expect(page.getByRole('status').last()).toContainText('obrigatório');
  await page.locator('[data-choice="Não"]').click();
  await proximo(page);
  for (let i = 0; i < 12; i++) await pular(page);
  await expect(page.getByTestId('os-item')).toHaveCount(2);

  // Ver respostas
  await page.getByRole('button', { name: 'Ver respostas OS 456' }).click();
  await expect(page.getByRole('dialog')).toContainText('OS 456');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();

  // Encerrar turno
  await page.locator('#btn-finish').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Confirmar e gerar PDF/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^Folha_Producao_Energisa_Joao_\d{2}-\d{2}-\d{4}\.pdf$/);
  await expect(page.getByRole('dialog')).toContainText('Folha encerrada');
  await page.getByRole('button', { name: 'OK' }).click();

  // Volta para o cabeçalho vazio, com a última folha disponível
  await expect(page.locator('#screen-header')).toBeVisible();
  await expect(page.getByLabel('Nome 1 *')).toHaveValue('');
  await expect(page.getByTestId('last-sheet')).toContainText('2 OSs');
  const again = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar PDF' }).click();
  expect((await again).suggestedFilename()).toContain('Folha_Producao_Energisa_Joao');

  await page.getByRole('button', { name: 'Usar equipe do último turno' }).click();
  await expect(page.getByLabel('Nome 1 *')).toHaveValue('João da Silva');
});

test('OS em preenchimento sobrevive ao recarregar a página', async ({ page }) => {
  await iniciarTurno(page);
  await abrirOS(page, '789', '28');
  await page.locator('#wiz-text-input').fill('Vistoria');
  await page.reload();
  await expect(page.locator('#screen-wizard')).toBeVisible();
  await expect(page.locator('#wiz-text-input')).toHaveValue('Vistoria');

  await page.getByRole('button', { name: 'Cancelar OS' }).click();
  await page.getByRole('button', { name: 'Descartar OS' }).click();
  await expect(page.getByTestId('os-item')).toHaveCount(0);
});

test('editar uma OS concluída e corrigir o cabeçalho mantém a folha', async ({ page }) => {
  await iniciarTurno(page);
  await abrirOS(page, '321', '33');
  await page.locator('#wiz-text-input').fill('Corte');
  await proximo(page);
  await pular(page);
  await pular(page);

  await page.getByRole('button', { name: 'Editar OS 321' }).click();
  await expect(page.locator('#wiz-text-input')).toHaveValue('Corte');
  await page.locator('#wiz-text-input').fill('Religação');
  await proximo(page);
  await pular(page);
  await page.locator('#btn-wiz-next').filter({ hasText: 'Salvar alterações' }).waitFor();
  await pular(page);
  await expect(page.getByTestId('os-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Ver respostas OS 321' }).click();
  await expect(page.getByRole('dialog')).toContainText('Religação');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Corrigir' }).click();
  await page.getByLabel('Nome 1 *').fill('João Souza');
  await page.getByRole('button', { name: /Salvar cabeçalho/ }).click();
  await expect(page.getByText('João Souza (Mat: 123456)')).toBeVisible();
  await expect(page.getByTestId('os-item')).toHaveCount(1);
});

test('abre sem internet depois do primeiro acesso', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // garante a página controlada pelo service worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /Iniciar turno/ })).toBeVisible();
});
