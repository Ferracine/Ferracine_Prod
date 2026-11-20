import { expect, test, type Page } from '@playwright/test';

async function iniciarTurno(page: Page) {
  await page.goto('/');
  await page.getByLabel('Nome 1 *').fill('João da Silva');
  await page.getByLabel('Mat. 1 *').fill('123456');
  await page.getByLabel('Equipe', { exact: true }).fill('PVH-01');
  await page.getByLabel('Início *').fill('07:00');
  await page.getByLabel('Fim *').fill('17:00');
  await page.getByLabel('Técnico líder responsável').selectOption({ index: 2 });
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

test('turno completo: OS sem número, OS de ocorrência com DITAIS, PDF e encerramento', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.getByRole('alert')).toContainText('Preencha Nome 1');

  await iniciarTurno(page);
  await expect(page.getByText('João da Silva (Mat: 123456)')).toBeVisible();
  await expect(page.getByText('Equipe PVH-01')).toBeVisible();

  // Comercial sem número da OS (S/N)
  await abrirOS(page, '', '709');
  await expect(page.locator('#wiz-os-number')).toHaveText('S/N');
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
  await expect(page.getByTestId('os-item')).toContainText('sem nº');

  // Preenche o número depois pelo lápis
  await page.getByRole('button', { name: 'Editar nº OS S/N' }).click();
  await page.locator('#edit-os-input').fill('123');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByTestId('os-item')).toContainText('OS 123');
  await expect(page.getByTestId('os-item')).not.toContainText('sem nº');

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

  // Gerar PDF: baixa na hora, mas o turno continua aberto até "Encerrar turno"
  await page.locator('#btn-finish').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Gerar PDF/ }).click();
  expect((await download).suggestedFilename()).toBe('Joao_da_Silva_2_servicos.pdf');
  await expect(page.getByRole('dialog')).toContainText('PDF gerado');
  const again = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Baixar PDF' }).click();
  expect((await again).suggestedFilename()).toBe('Joao_da_Silva_2_servicos.pdf');
  await page.getByRole('button', { name: 'Encerrar turno' }).click();

  // Volta para o cabeçalho vazio, com a última folha disponível
  await expect(page.locator('#screen-header')).toBeVisible();
  await expect(page.getByLabel('Nome 1 *')).toHaveValue('');
  await expect(page.getByTestId('last-sheet')).toContainText('2 OSs');
  const last = page.waitForEvent('download');
  await page.getByTestId('last-sheet').getByRole('button', { name: 'Baixar PDF' }).click();
  expect((await last).suggestedFilename()).toBe('Joao_da_Silva_2_servicos.pdf');

  await page.getByRole('button', { name: 'Usar equipe do último turno' }).click();
  await expect(page.getByLabel('Nome 1 *')).toHaveValue('João da Silva');
  await expect(page.getByLabel('Equipe', { exact: true })).toHaveValue('PVH-01');
});

test('fechar a janela do PDF sem encerrar mantém o turno aberto', async ({ page }) => {
  await iniciarTurno(page);
  await page.locator('#btn-finish').click();
  await page.getByRole('button', { name: 'Gerar mesmo assim' }).click();
  await expect(page.getByRole('dialog')).toContainText('PDF gerado');
  await page.keyboard.press('Escape');
  await expect(page.locator('#screen-dashboard')).toBeVisible();
});

test('outro código fora da lista abre o assistente com esse código', async ({ page }) => {
  await iniciarTurno(page);
  await page.locator('#custom-code-ocorrencia').fill('510');
  await page.locator('[data-start-custom="OCORRENCIA"]').click();
  await expect(page.locator('#screen-wizard')).toContainText('Código 510');
  await expect(page.locator('#wiz-step-label')).toHaveText('Pergunta 1 de 18');
});

test('número repetido pelo lápis pede confirmação', async ({ page }) => {
  await iniciarTurno(page);
  for (const numero of ['500', '']) {
    await abrirOS(page, numero, '28');
    for (let i = 0; i < 3; i++) await pular(page);
  }
  await page.getByRole('button', { name: 'Editar nº OS S/N' }).click();
  await page.locator('#edit-os-input').fill('500');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('dialog')).toContainText('A OS 500 já está nesta folha');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByTestId('os-item').nth(1)).toContainText('sem nº');
});

test('voltar da tela e do Android: pergunta anterior e, na primeira, volta ao painel', async ({ page }) => {
  await iniciarTurno(page);
  await abrirOS(page, '901', '508');
  await page.locator('#wiz-text-input').fill('Falta de energia');
  await proximo(page);
  await expect(page.locator('#wiz-step-label')).toHaveText('Pergunta 2 de 18');

  // Voltar do sistema (botão/gesto do Android) = pergunta anterior, sem sair do app.
  await page.goBack();
  await expect(page.locator('#wiz-step-label')).toHaveText('Pergunta 1 de 18');
  await expect(page.locator('#btn-wiz-prev')).toHaveText('Voltar ao painel');

  // Já há resposta: pede confirmação antes de descartar.
  await page.locator('#btn-wiz-prev').click();
  await expect(page.getByRole('dialog')).toContainText('Cancelar registro da OS');
  await page.getByRole('button', { name: 'Descartar OS' }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();

  // OS aberta e nada respondido: volta direto, também pelo voltar do sistema.
  await abrirOS(page, '902', '28');
  await page.goBack();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await expect(page.getByTestId('os-item')).toHaveCount(0);
});

test('recarregar no meio da OS não deixa um "voltar" morto no histórico', async ({ page }) => {
  await iniciarTurno(page);
  await abrirOS(page, '903', '28');
  await page.reload();
  await page.reload();
  await expect(page.locator('#screen-wizard')).toBeVisible();
  await page.locator('#btn-wiz-prev').click(); // nada respondido: volta direto ao painel
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  // Uma única entrada de histórico do app deve ter sobrado (a da página).
  await expect.poll(() => page.evaluate(() => history.state?.ferracineBackTrap ?? false)).toBe(false);
});

test('tema claro e escuro: alterna e fica salvo', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const inicial = await html.getAttribute('data-theme');
  expect(['light', 'dark']).toContain(inicial);
  await page.locator('#theme-toggle').click();
  const trocado = inicial === 'dark' ? 'light' : 'dark';
  await expect(html).toHaveAttribute('data-theme', trocado);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', trocado);
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

test('editar respostas de uma OS concluída e corrigir o cabeçalho mantém a folha', async ({ page }) => {
  await iniciarTurno(page);
  await abrirOS(page, '321', '33');
  await page.locator('#wiz-text-input').fill('Corte');
  await proximo(page);
  await pular(page);
  await pular(page);

  await page.getByRole('button', { name: 'Ver respostas OS 321' }).click();
  await page.getByRole('button', { name: 'Editar respostas' }).click();
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
