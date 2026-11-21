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

/** "+" do painel → código na janela → tela da OS nova. */
async function novaOS(page: Page, codigo: string, numero = '') {
  await page.locator('#btn-new-os').click();
  await page.getByTestId('service-chooser').locator(`[data-code="${codigo}"]`).click();
  await expect(page.locator('#screen-os[data-mode="new"]')).toBeVisible();
  if (numero) await page.locator('#os-number').fill(numero);
}

const salvar = (page: Page) => page.locator('#btn-os-save').click();
const marcar = (page: Page, pergunta: string, escolha: 'Sim' | 'Não') => page.locator(`[data-question="${pergunta}"] [data-choice="${escolha}"]`).click();

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
  await expect(page.getByText('© Ferracine Prod')).toBeVisible();

  // Comercial sem número (S/N): a tela da OS traz as 12 perguntas de uma vez.
  await novaOS(page, '709');
  await expect(page.locator('#os-number')).toHaveValue('');
  await expect(page.locator('#os-code')).toHaveValue('709');
  await expect(page.locator('#screen-os [data-question]')).toHaveCount(12);
  await page.locator('#q-tipo').fill('Ligação nova');
  await marcar(page, 'clientePresente', 'Sim');
  await salvar(page);
  await expect(page.getByTestId('os-item')).toHaveCount(1);
  await expect(page.getByTestId('os-item')).toContainText('sem nº');

  // Lápis: mesma tela; preenche o número.
  await page.getByRole('button', { name: 'Editar OS S/N' }).click();
  await expect(page.locator('#screen-os[data-mode="edit"]')).toBeVisible();
  await expect(page.locator('#q-tipo')).toHaveValue('Ligação nova');
  await page.locator('#os-number').fill('123');
  await salvar(page);
  await expect(page.getByTestId('os-item')).toContainText('OS 123');
  await expect(page.getByTestId('os-item')).not.toContainText('sem nº');

  // Ocorrência: a pergunta do número é o campo do topo (11 blocos) e a DITAIS é obrigatória.
  await novaOS(page, '508', '456');
  await expect(page.locator('#screen-os [data-question]')).toHaveCount(11);
  await salvar(page);
  await expect(page.getByRole('status').last()).toContainText('resposta obrigatória');
  await marcar(page, 'ditais', 'Não');
  await salvar(page);
  await expect(page.getByTestId('os-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ver respostas OS 456' }).click();
  await expect(page.getByRole('dialog')).toContainText('456');
  await page.keyboard.press('Escape');

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

test('o "+" abre a escolha do serviço e Cancelar volta ao painel sem criar OS', async ({ page }) => {
  await iniciarTurno(page);
  await expect(page.getByText('Registrar nova Ordem de Serviço')).toHaveCount(0);
  await page.locator('#btn-new-os').click();
  await expect(page.getByTestId('service-chooser')).toContainText('COMERCIAL');
  await expect(page.getByTestId('service-chooser')).toContainText('OCORRÊNCIA');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await expect(page.getByTestId('os-item')).toHaveCount(0);

  // Voltar do Android (APK chama window.ferracineBack antes de navegar): fecha a janela em vez de sair do app.
  await page.locator('#btn-new-os').click();
  expect(await page.evaluate(() => window.ferracineBack?.())).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => window.ferracineBack?.())).toBe(false);
});

test('OS nova: trocar só o código e cancelar pede confirmação', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, '508');
  await page.locator('#os-code').fill('510');
  await page.locator('#screen-os').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cancelar registro da OS');
});

test('lápis edita qualquer item da OS e o voltar do Android pede para descartar alterações', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, '33', '321');
  await page.locator('#q-tipo').fill('Corte');
  await salvar(page);

  await page.getByRole('button', { name: 'Editar OS 321' }).click();
  await expect(page.locator('#q-tipo')).toHaveValue('Corte');
  await page.locator('#q-tipo').fill('Religação');
  await page.locator('#q-kmIni').fill('45210');
  await page.locator('#os-code').fill('798');
  await marcar(page, 'clientePresente', 'Sim');
  await marcar(page, 'dificuldade', 'Sim');
  // SIM sem complemento: não salva.
  await salvar(page);
  await expect(page.getByRole('status').last()).toContainText('preencha o complemento');
  await page.locator('[data-question="dificuldade"] input').fill('Chuva forte');
  await salvar(page);

  await expect(page.getByTestId('os-item')).toContainText('Cód. 798');
  await page.getByRole('button', { name: 'Ver respostas OS 321' }).click();
  for (const t of ['Religação', '45210', 'Sim — Chuva forte']) await expect(page.getByRole('dialog')).toContainText(t);
  await page.keyboard.press('Escape');

  // Voltar do sistema na edição com alterações: confirma antes de descartar.
  await page.getByRole('button', { name: 'Editar OS 321' }).click();
  await page.locator('#q-tipo').fill('Outra coisa');
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

test('outro código fora da lista abre a OS com esse código', async ({ page }) => {
  await iniciarTurno(page);
  await page.locator('#btn-new-os').click();
  await page.locator('#custom-code-ocorrencia').fill('510');
  await page.locator('[data-start-custom="OCORRENCIA"]').click();
  await expect(page.locator('#screen-os[data-mode="new"]')).toContainText('OCORRÊNCIA');
  await expect(page.locator('#os-code')).toHaveValue('510');
});

test('número repetido pede confirmação (OS nova e edição)', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, '28', '500');
  await salvar(page);
  await novaOS(page, '28', '500');
  await salvar(page);
  await expect(page.getByRole('dialog')).toContainText('A OS 500 já está nesta folha');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('#os-number').fill('');
  await salvar(page);
  await expect(page.getByTestId('os-item')).toHaveCount(2);

  await page.getByRole('button', { name: 'Editar OS S/N' }).click();
  await page.locator('#os-number').fill('500');
  await salvar(page);
  await expect(page.getByRole('dialog')).toContainText('A OS 500 já está nesta folha');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#screen-os[data-mode="edit"]')).toBeVisible();
  await page.locator('#screen-os').getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Descartar alterações' }).click();
  await expect(page.getByTestId('os-item').nth(1)).toContainText('sem nº');
});

test('voltar do Android na OS nova: com algo preenchido confirma; sem nada volta direto', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, '508');
  await marcar(page, 'callback', 'Sim');
  await page.goBack();
  await expect(page.getByRole('dialog')).toContainText('Cancelar registro da OS');
  await page.getByRole('button', { name: 'Continuar preenchendo' }).click();
  await expect(page.locator('[data-question="callback"] [data-choice="Sim"]')).toHaveAttribute('aria-pressed', 'true');

  await page.goBack();
  await page.getByRole('button', { name: 'Descartar OS' }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();

  // OS aberta e nada preenchido: volta direto, também pelo voltar do sistema.
  await novaOS(page, '28');
  await page.goBack();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await expect(page.getByTestId('os-item')).toHaveCount(0);
});

test('recarregar no meio da OS não deixa um "voltar" morto no histórico', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, '28');
  await page.reload();
  await page.reload();
  await expect(page.locator('#screen-os[data-mode="new"]')).toBeVisible();
  await page.locator('#screen-os').getByRole('button', { name: 'Cancelar' }).click(); // nada preenchido: volta direto
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
  await novaOS(page, '28', '789');
  await page.locator('#q-tipo').fill('Vistoria');
  await marcar(page, 'clientePresente', 'Não');
  await page.reload();
  await expect(page.locator('#screen-os[data-mode="new"]')).toBeVisible();
  await expect(page.locator('#os-number')).toHaveValue('789');
  await expect(page.locator('#q-tipo')).toHaveValue('Vistoria');
  await expect(page.locator('[data-question="clientePresente"] [data-choice="Não"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#screen-os').getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Descartar OS' }).click();
  await expect(page.getByTestId('os-item')).toHaveCount(0);
});

test('corrigir o cabeçalho mantém a folha', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, '28', '1');
  await salvar(page);
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
