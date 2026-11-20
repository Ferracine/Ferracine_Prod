import { expect, test, type Page } from '@playwright/test';

/** Cadastra um técnico pela janela "Adicionar / excluir técnicos" do cabeçalho. */
async function cadastrarTecnico(page: Page, nome: string, telefone: string) {
  await page.locator('#btn-tecnicos').click();
  await page.locator('#tecnico-nome').fill(nome);
  await page.locator('#tecnico-telefone').fill(telefone);
  await page.getByRole('button', { name: 'Adicionar técnico' }).click();
  await expect(page.getByTestId('tecnicos-list')).toContainText(nome);
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
}

async function iniciarTurno(page: Page) {
  await page.goto('/');
  await page.getByLabel('Nome 1 *').fill('João da Silva');
  await page.getByLabel('Mat. 1 *').fill('123456');
  await page.getByLabel('Equipe', { exact: true }).fill('PVH-01');
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
async function pularVarias(page: Page, n: number) {
  for (let i = 0; i < n; i++) await pular(page);
}

test('turno completo: OS sem número, ocorrência com DITAIS, PDF, encerramento e próximo turno já preenchido', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.getByRole('alert')).toContainText('Preencha Nome 1');

  // Técnico líder começa em branco; cadastra e escolhe.
  await expect(page.getByLabel('Técnico líder responsável')).toHaveValue('');
  await cadastrarTecnico(page, 'TEC. ANA LIMA', '69 99999-0000');
  await page.getByLabel('Técnico líder responsável').selectOption({ label: 'TEC. ANA LIMA - 69 99999-0000' });
  await iniciarTurno(page);
  await expect(page.getByText('João da Silva (Mat: 123456)')).toBeVisible();

  // Comercial sem número (S/N): 12 perguntas na ordem nova.
  await abrirOS(page, '', '709');
  await expect(page.locator('#wiz-os-number')).toHaveText('S/N');
  await expect(page.locator('#wiz-step-label')).toHaveText('Pergunta 1 de 12');
  await expect(page.locator('#wiz-question-text')).toHaveText('Qual tipo de serviço?');
  await proximo(page);
  await expect(page.getByRole('status').last()).toContainText('Digite uma resposta');
  await page.locator('#wiz-text-input').fill('Ligação nova');
  await page.locator('#wiz-text-input').press('Enter');
  await pularVarias(page, 2); // KM inicial, hora inicial
  await expect(page.locator('#wiz-question-text')).toHaveText('Cliente presente?');
  await page.locator('[data-choice="Sim"]').click();
  await proximo(page);
  await pularVarias(page, 7);
  await expect(page.locator('#btn-wiz-next')).toHaveText(/Concluir OS/);
  await pular(page);
  await expect(page.getByTestId('os-item')).toHaveCount(1);
  await expect(page.getByTestId('os-item')).toContainText('sem nº');

  // Lápis: edição completa; preenche o número.
  await page.getByRole('button', { name: 'Editar OS S/N' }).click();
  await expect(page.locator('#screen-edit')).toBeVisible();
  await page.locator('#edit-os-number').fill('123');
  await page.locator('#btn-edit-save').click();
  await expect(page.getByTestId('os-item')).toContainText('OS 123');
  await expect(page.getByTestId('os-item')).not.toContainText('sem nº');

  // Ocorrência: 12 perguntas; o número vem pré-preenchido e a DITAIS é obrigatória.
  await abrirOS(page, '456', '508');
  await expect(page.locator('#wiz-question-text')).toHaveText('Tentou callback?');
  await pular(page);
  await expect(page.locator('#wiz-text-input')).toHaveValue('456');
  await proximo(page);
  await pularVarias(page, 5); // hora inicial, KM inicial, tipo, defeito, dispositivo
  await expect(page.locator('#wiz-question-text')).toHaveText('Houve necessidade de realizar os DITAIS?');
  await expect(page.locator('#btn-wiz-skip')).toHaveCount(0);
  await proximo(page);
  await expect(page.getByRole('status').last()).toContainText('obrigatório');
  await page.locator('[data-choice="Não"]').click();
  await proximo(page);
  await pularVarias(page, 4); // KM final, alteração na UC, hora final, dificuldade
  await expect(page.getByTestId('os-item')).toHaveCount(2);

  // Gerar PDF: baixa na hora; o turno continua aberto até "Encerrar turno".
  await page.locator('#btn-finish').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Gerar PDF/ }).click();
  expect((await download).suggestedFilename()).toBe('Joao_da_Silva_2_servicos.pdf');
  await expect(page.getByRole('dialog')).toContainText('PDF gerado');
  await page.getByRole('button', { name: 'Encerrar turno' }).click();

  // Próximo turno: dados da equipe já preenchidos, data de hoje e técnico líder em branco.
  await expect(page.locator('#screen-header')).toBeVisible();
  await expect(page.getByLabel('Nome 1 *')).toHaveValue('João da Silva');
  await expect(page.getByLabel('Equipe', { exact: true })).toHaveValue('PVH-01');
  await expect(page.getByLabel('Início *')).toHaveValue('07:00');
  const hoje = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await expect(page.getByLabel('Data *')).toHaveValue(hoje);
  await expect(page.getByLabel('Técnico líder responsável')).toHaveValue('');
  await expect(page.getByTestId('last-sheet')).toContainText('2 OSs');
  const last = page.waitForEvent('download');
  await page.getByTestId('last-sheet').getByRole('button', { name: 'Baixar PDF' }).click();
  expect((await last).suggestedFilename()).toBe('Joao_da_Silva_2_servicos.pdf');
});

test('lápis edita qualquer item da OS e o voltar do Android pede para descartar alterações', async ({ page }) => {
  await iniciarTurno(page);
  await abrirOS(page, '321', '33');
  await page.locator('#wiz-text-input').fill('Corte');
  await proximo(page);
  await pularVarias(page, 11);

  await page.getByRole('button', { name: 'Editar OS 321' }).click();
  await expect(page.locator('#edit-tipo')).toHaveValue('Corte');
  await page.locator('#edit-tipo').fill('Religação');
  await page.locator('#edit-kmIni').fill('45210');
  await page.locator('#edit-os-code').fill('798');
  await page.locator('[data-question="clientePresente"] [data-choice="Sim"]').click();
  await page.locator('[data-question="dificuldade"] [data-choice="Sim"]').click();
  // SIM sem complemento: não salva.
  await page.locator('#btn-edit-save').click();
  await expect(page.getByRole('status').last()).toContainText('preencha o complemento');
  await page.locator('[data-question="dificuldade"] input').fill('Chuva forte');
  await page.locator('#btn-edit-save').click();

  await expect(page.getByTestId('os-item')).toContainText('Cód. 798');
  await page.getByRole('button', { name: 'Ver respostas OS 321' }).click();
  for (const t of ['Religação', '45210', 'Sim — Chuva forte']) await expect(page.getByRole('dialog')).toContainText(t);
  await page.keyboard.press('Escape');

  // Voltar do sistema na edição com alterações: confirma antes de descartar.
  await page.getByRole('button', { name: 'Editar OS 321' }).click();
  await page.locator('#edit-tipo').fill('Outra coisa');
  await page.goBack();
  await expect(page.getByRole('dialog')).toContainText('Sair sem salvar?');
  await page.getByRole('button', { name: 'Descartar alterações' }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await page.getByRole('button', { name: 'Ver respostas OS 321' }).click();
  await expect(page.getByRole('dialog')).toContainText('Religação');
});

test('técnicos: cadastrar, excluir e a lista do cabeçalho acompanha', async ({ page }) => {
  await page.goto('/');
  await cadastrarTecnico(page, 'TEC. UM', '69 1111-1111');
  await cadastrarTecnico(page, 'TEC. DOIS', '');
  const lider = page.getByLabel('Técnico líder responsável');
  await expect(lider.locator('option')).toHaveText(['—', 'TEC. UM - 69 1111-1111', 'TEC. DOIS']);

  await page.locator('#btn-tecnicos').click();
  await page.getByRole('button', { name: 'Excluir técnico TEC. UM' }).click();
  await expect(page.getByTestId('tecnicos-list')).not.toContainText('TEC. UM');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(lider.locator('option')).toHaveText(['—', 'TEC. DOIS']);

  // O que foi digitado no formulário não se perde ao mexer nos técnicos.
  await page.getByLabel('Nome 1 *').fill('Maria');
  await cadastrarTecnico(page, 'TEC. TRES', '69 3333-3333');
  await expect(page.getByLabel('Nome 1 *')).toHaveValue('Maria');
  await page.reload();
  await expect(lider.locator('option')).toHaveText(['—', 'TEC. DOIS', 'TEC. TRES - 69 3333-3333']);
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
  await expect(page.locator('#wiz-step-label')).toHaveText('Pergunta 1 de 12');
});

test('número repetido na edição pede confirmação', async ({ page }) => {
  await iniciarTurno(page);
  for (const numero of ['500', '']) {
    await abrirOS(page, numero, '28');
    await pularVarias(page, 12);
  }
  await page.getByRole('button', { name: 'Editar OS S/N' }).click();
  await page.locator('#edit-os-number').fill('500');
  await page.locator('#btn-edit-save').click();
  await expect(page.getByRole('dialog')).toContainText('A OS 500 já está nesta folha');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#screen-edit')).toBeVisible();
  await page.locator('#screen-edit').getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Descartar alterações' }).click();
  await expect(page.getByTestId('os-item').nth(1)).toContainText('sem nº');
});

test('voltar da tela e do Android: pergunta anterior e, na primeira, volta ao painel', async ({ page }) => {
  await iniciarTurno(page);
  await abrirOS(page, '901', '508');
  await page.locator('[data-choice="Sim"]').click();
  await proximo(page);
  await expect(page.locator('#wiz-step-label')).toHaveText('Pergunta 2 de 12');

  await page.goBack();
  await expect(page.locator('#wiz-step-label')).toHaveText('Pergunta 1 de 12');
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

test('corrigir o cabeçalho mantém a folha', async ({ page }) => {
  await iniciarTurno(page);
  await abrirOS(page, '1', '28');
  await pularVarias(page, 12);
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
