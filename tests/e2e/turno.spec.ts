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

/** Cadastra eletricistas pela janela "Adicionar / excluir eletricistas" do cabeçalho. */
async function cadastrarEletricistas(page: Page, ...pessoas: [string, string][]) {
  await page.locator('#btn-eletricistas').click();
  for (const [nome, mat] of pessoas) {
    await page.locator('#eletricista-nome').fill(nome);
    await page.locator('#eletricista-matricula').fill(mat);
    await page.getByRole('button', { name: 'Adicionar eletricista' }).click();
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
}

/** Cadastra e escolhe o Eletricista 1 (turno solo). */
async function escolherEletricista1(page: Page, nome: string, mat: string) {
  await cadastrarEletricistas(page, [nome, mat]);
  await page.locator('#eletricista1').selectOption({ label: nome.toUpperCase() });
  await expect(page.locator('#matricula1')).toHaveValue(mat);
}

/** Cadastra e escolhe o técnico líder (obrigatório para iniciar o turno). */
async function escolherLider(page: Page) {
  await cadastrarTecnico(page, 'TEC. LIDER', '69 90000-0000');
  await page.locator('#lider').selectOption({ label: 'TEC. LIDER - 69 90000-0000' });
}

async function iniciarTurno(page: Page) {
  await page.goto('/');
  await escolherEletricista1(page, 'João da Silva', '123456');
  await escolherLider(page);
  await page.getByLabel('Equipe', { exact: true }).fill('PVH-01');
  await page.getByLabel('Início *').fill('07:00');
  await page.getByLabel('Fim *').fill('17:00');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
}

const salvar = (page: Page) => page.locator('#btn-os-save').click();
const marcar = (page: Page, pergunta: string, escolha: 'Sim' | 'Não') => page.locator(`[data-question="${pergunta}"] [data-choice="${escolha}"]`).click();

/**
 * "+" Comercial ou "+" Ocorrência → tela da OS em branco; preenche código, número e a DITAIS (obrigatória nos dois
 * tipos; `null` deixa em branco, para testar a falta).
 */
async function novaOS(page: Page, tipo: 'comercial' | 'ocorrencia', codigo: string, numero = '', ditais: 'Sim' | 'Não' | null = 'Não') {
  await page.locator(`#btn-new-${tipo}`).click();
  await expect(page.locator('#screen-os[data-mode="new"]')).toBeVisible();
  await page.locator('#os-code').fill(codigo);
  if (numero) await page.locator('#os-number').fill(numero);
  if (ditais) await marcar(page, 'ditais', ditais);
}

test('turno completo: OS sem número, ocorrência com DITAIS, PDF, encerramento e próximo turno já preenchido', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.getByRole('alert')).toContainText('Escolha o Eletricista 1');

  // Técnico líder começa em branco; cadastra e escolhe.
  await expect(page.getByLabel('Técnico líder responsável')).toHaveValue('');
  await cadastrarTecnico(page, 'TEC. ANA LIMA', '69 99999-0000');
  await page.getByLabel('Técnico líder responsável').selectOption({ label: 'TEC. ANA LIMA - 69 99999-0000' });
  await iniciarTurno(page);
  await expect(page.getByTestId('header-info')).toContainText('JOÃO DA SILVA');
  await expect(page.getByTestId('header-info')).toContainText('123456');
  await expect(page.getByText('© Ferracine Prod')).toBeVisible();

  // Comercial sem número (S/N): a tela da OS traz as perguntas de uma vez (sem as do medidor novo, escondidas).
  await novaOS(page, 'comercial', '709');
  await expect(page.locator('#os-number')).toHaveValue('');
  await expect(page.locator('#os-code')).toHaveValue('709');
  await expect(page.locator('#screen-os [data-question]:visible')).toHaveCount(12);
  await page.locator('#q-tipo').fill('LIGAÇÃO NOVA');
  await marcar(page, 'clientePresente', 'Sim');
  await salvar(page);
  await expect(page.getByTestId('os-item')).toHaveCount(1);
  await expect(page.getByTestId('os-item')).toContainText('sem nº');

  // Lápis: mesma tela; preenche o número.
  await page.getByRole('button', { name: 'Editar OS S/N' }).click();
  await expect(page.locator('#screen-os[data-mode="edit"]')).toBeVisible();
  await expect(page.locator('#q-tipo')).toHaveValue('LIGAÇÃO NOVA');
  await page.locator('#os-number').fill('123');
  await salvar(page);
  await expect(page.getByTestId('os-item')).toContainText('OS 123');
  await expect(page.getByTestId('os-item')).not.toContainText('sem nº');

  // Ocorrência: a pergunta do número é o campo do topo (13 perguntas na tela, com medidor e leitura) e a DITAIS é obrigatória.
  await novaOS(page, 'ocorrencia', '508', '456', null);
  await expect(page.locator('#screen-os [data-question]')).toHaveCount(13);
  await salvar(page);
  await expect(page.getByRole('status').last()).toContainText('resposta obrigatória');
  await marcar(page, 'ditais', 'Não');
  await salvar(page);
  await expect(page.getByTestId('os-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ver respostas OS 456' }).click();
  await expect(page.getByRole('dialog')).toContainText('456');
  await page.keyboard.press('Escape');

  // Encerrar: sem pendência, um toque encerra o turno, sem janela e SEM baixar nada (só pelo "Baixar PDF").
  let baixou = false;
  page.on('download', () => (baixou = true));
  await page.locator('#btn-finish').click();
  await expect(page.locator('#screen-header')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(baixou).toBe(false);
  const hojeBR = await page.evaluate(() => new Date().toLocaleDateString('pt-BR').replaceAll('/', '-'));

  // Próximo turno: dados da equipe já preenchidos, data de hoje e técnico líder em branco.
  await expect(page.locator('#eletricista1 option:checked')).toHaveText('JOÃO DA SILVA');
  await expect(page.locator('#matricula1')).toHaveValue('123456');
  await expect(page.getByLabel('Equipe', { exact: true })).toHaveValue('PVH-01');
  await expect(page.getByLabel('Início *')).toHaveValue('07:00');
  const hoje = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await expect(page.getByLabel('Data *')).toHaveValue(hoje);
  await expect(page.getByLabel('Técnico líder responsável')).toHaveValue('');
  await expect(page.getByTestId('last-sheet')).toContainText('2 OSs');
  // Até baixar, a folha avisa "PDF não baixado"; baixar tira o aviso.
  await expect(page.getByTestId('last-sheet')).toContainText('PDF não baixado');
  // Abrir é só ver: o aviso continua.
  const aba = page.context().waitForEvent('page');
  await page.getByTestId('last-sheet').getByRole('button', { name: 'Abrir PDF' }).click();
  await (await aba).close();
  await expect(page.getByTestId('last-sheet')).toContainText('PDF não baixado');
  const last = page.waitForEvent('download');
  await page.getByTestId('last-sheet').getByRole('button', { name: 'Baixar PDF' }).click();
  expect((await last).suggestedFilename()).toBe(`JOAO_DA_SILVA_${hojeBR}_2_servicos.pdf`);
  await expect(page.getByTestId('last-sheet')).not.toContainText('PDF não baixado');
});

test('dois "+": Comercial e Ocorrência abrem a tela da OS em branco com as perguntas de cada tipo', async ({ page }) => {
  await iniciarTurno(page);
  await expect(page.getByText('Registrar nova Ordem de Serviço')).toHaveCount(0);

  await page.locator('#btn-new-comercial').click();
  await expect(page.locator('#screen-os[data-mode="new"]')).toContainText('COMERCIAL');
  await expect(page.locator('#os-number')).toHaveValue('');
  await expect(page.locator('#os-code')).toHaveValue('');
  await expect(page.locator('#screen-os [data-question]:visible')).toHaveCount(12);
  await expect(page.locator('#q-tipo')).toHaveValue('');
  await expect(page.getByLabel('Número da OS comercial')).toBeVisible();
  // Sem código não salva: avisa e leva ao campo.
  await salvar(page);
  await expect(page.getByRole('status').last()).toContainText('Informe o código');
  await expect(page.locator('#os-code')).toBeFocused();
  // DITAIS também é obrigatória na comercial.
  await page.locator('#os-code').fill('508');
  await salvar(page);
  await expect(page.locator('[data-question="ditais"]')).toHaveClass(/faltando/);
  // Sem trava de código: um código que antes era "de ocorrência" vale na comercial.
  await marcar(page, 'ditais', 'Não');
  await salvar(page);
  await expect(page.getByTestId('os-item')).toContainText('Cód. 508');
  await expect(page.getByTestId('os-item')).toContainText('COMERCIAL');
  await page.getByRole('button', { name: /Excluir OS/ }).click();
  await page.getByRole('button', { name: 'Sim, excluir' }).click();
  await expect(page.getByTestId('os-item')).toHaveCount(0);

  await page.locator('#btn-new-ocorrencia').click();
  await expect(page.locator('#screen-os[data-mode="new"]')).toContainText('OCORRÊNCIA');
  await expect(page.getByLabel('Número da ocorrência')).toBeVisible();
  await expect(page.locator('#screen-os [data-question="ditais"]')).toContainText('obrigatória');
  // Qualquer código vale.
  await page.locator('#os-code').fill('510');
  await marcar(page, 'ditais', 'Não');
  await salvar(page);
  await expect(page.getByTestId('os-item')).toContainText('Cód. 510');
  await expect(page.getByTestId('os-item')).toContainText('OCORRÊNCIA');
});

test('OS nova: digitar só o código e cancelar pede confirmação', async ({ page }) => {
  await iniciarTurno(page);
  await page.locator('#btn-new-ocorrencia').click();
  await page.locator('#os-code').fill('510');
  await page.locator('#screen-os').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cancelar registro da OS');
});

test('voltar do Android com uma janela aberta fecha a janela (o APK chama window.ferracineBack antes)', async ({ page }) => {
  await iniciarTurno(page);
  expect(await page.evaluate(() => window.ferracineBack?.())).toBe(false);
  await novaOS(page, 'comercial', '28', '77');
  await page.locator('#screen-os').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cancelar registro da OS');
  expect(await page.evaluate(() => window.ferracineBack?.())).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#os-number')).toHaveValue('77');
});

test('lápis edita qualquer item da OS e o voltar do Android pede para descartar alterações', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, 'comercial', '33', '321');
  await page.locator('#q-tipo').fill('CORTE');
  await salvar(page);

  await page.getByRole('button', { name: 'Editar OS 321' }).click();
  await expect(page.locator('#q-tipo')).toHaveValue('CORTE');
  await page.locator('#q-tipo').fill('RELIGAÇÃO');
  await page.locator('#q-kmIni').fill('45210');
  await page.locator('#os-code').fill('798');
  await marcar(page, 'clientePresente', 'Sim');
  // Informações adicionais: caixa aberta de várias linhas (texto em maiúsculas, como os outros campos).
  await expect(page.locator('#q-infoAdicional')).toHaveJSProperty('tagName', 'TEXTAREA');
  await page.locator('#q-infoAdicional').fill('chuva forte');
  await salvar(page);

  await expect(page.getByTestId('os-item')).toContainText('Cód. 798');
  await page.getByRole('button', { name: 'Ver respostas OS 321' }).click();
  for (const t of ['RELIGAÇÃO', '45210', 'Informações adicionais', 'CHUVA FORTE']) await expect(page.getByRole('dialog')).toContainText(t);
  await page.keyboard.press('Escape');

  // Voltar do sistema na edição com alterações: confirma antes de descartar.
  await page.getByRole('button', { name: 'Editar OS 321' }).click();
  await page.locator('#q-tipo').fill('OUTRA COISA');
  await page.goBack();
  await expect(page.getByRole('dialog')).toContainText('Sair sem salvar?');
  await page.getByRole('button', { name: 'Descartar alterações' }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await page.getByRole('button', { name: 'Ver respostas OS 321' }).click();
  await expect(page.getByRole('dialog')).toContainText('RELIGAÇÃO');
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
  await page.getByLabel('Equipe', { exact: true }).fill('PVH-09');
  await cadastrarTecnico(page, 'TEC. TRES', '69 3333-3333');
  await expect(page.getByLabel('Equipe', { exact: true })).toHaveValue('PVH-09');
  await page.reload();
  await expect(lider.locator('option')).toHaveText(['—', 'TEC. DOIS', 'TEC. TRES - 69 3333-3333']);
});

test('encerrar com pendência (nenhuma OS ou OS S/N): pergunta antes; "Voltar e corrigir" mantém o turno aberto', async ({ page }) => {
  await iniciarTurno(page);
  await page.locator('#btn-finish').click();
  await expect(page.getByRole('dialog')).toContainText('Nenhuma OS registrada');
  await page.getByRole('button', { name: 'Voltar e corrigir' }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await novaOS(page, 'comercial', '28'); // sem número (S/N)
  await salvar(page);
  await page.locator('#btn-finish').click();
  await expect(page.getByRole('dialog')).toContainText('1 OS está sem número (S/N)');
  await page.getByRole('button', { name: 'Encerrar mesmo assim' }).click();
  await expect(page.locator('#screen-header')).toBeVisible();
  await expect(page.getByTestId('last-sheet')).toContainText('1 OS');
});

test('número repetido pede confirmação (OS nova e edição)', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, 'comercial', '28', '500');
  await salvar(page);
  await novaOS(page, 'comercial', '28', '500');
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
  await novaOS(page, 'ocorrencia', '508');
  await marcar(page, 'callback', 'Sim');
  await page.goBack();
  await expect(page.getByRole('dialog')).toContainText('Cancelar registro da OS');
  await page.getByRole('button', { name: 'Continuar preenchendo' }).click();
  await expect(page.locator('[data-question="callback"] [data-choice="Sim"]')).toHaveAttribute('aria-pressed', 'true');

  await page.goBack();
  await page.getByRole('button', { name: 'Descartar OS' }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();

  // OS aberta e nada preenchido: volta direto, também pelo voltar do sistema.
  await page.locator('#btn-new-comercial').click();
  await page.goBack();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await expect(page.getByTestId('os-item')).toHaveCount(0);
});

test('recarregar no meio da OS não deixa um "voltar" morto no histórico', async ({ page }) => {
  await iniciarTurno(page);
  await page.locator('#btn-new-comercial').click();
  await page.reload();
  await page.reload();
  await expect(page.locator('#screen-os[data-mode="new"]')).toBeVisible();
  await page.locator('#screen-os').getByRole('button', { name: 'Cancelar' }).click(); // nada preenchido: volta direto
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.ferracineBackTrap ?? false)).toBe(false);
});

test('avisos rápidos: sem borda e centralizados sobre o app também no computador', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await iniciarTurno(page);
  const toast = page.getByRole('status').filter({ hasText: 'Turno iniciado' });
  await expect(toast).toBeVisible();
  expect(await toast.evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe('0px');
  const box = await toast.boundingBox(); // o aviso dura ~3,8 s: mede logo
  const app = await page.locator('#app').boundingBox();
  expect(box && app).toBeTruthy();
  expect(Math.abs(box!.x + box!.width / 2 - (app!.x + app!.width / 2))).toBeLessThan(4);

  // Aviso disparado com uma janela aberta aparece acima dela (não atrás do fundo escurecido).
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.locator('#btn-tecnicos').click();
  await page.getByRole('button', { name: 'Adicionar técnico' }).click();
  const alerta = page.getByRole('status').filter({ hasText: 'Digite o nome do técnico' });
  await expect(alerta).toBeVisible();
  const z = await alerta.evaluate((el) => Number(getComputedStyle(el.parentElement!).zIndex) - Number(getComputedStyle(document.getElementById('modal')!).zIndex));
  expect(z).toBeGreaterThan(0);
});

test('medidores da comercial: o da UC sempre; o novo só com "Foi instalado novo medidor?" = SIM, recuado', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, 'comercial', '709', '55');
  // Medidor da UC: sempre na tela.
  await expect(page.locator('#q-medidorInstNum')).toBeVisible();
  await expect(page.locator('#q-leituraInst')).toBeVisible();
  await page.locator('#q-medidorInstNum').fill('uc777');
  await page.locator('#q-leituraInst').fill('900');
  const novo = ['novoMedidorNum', 'novoLeitura'].map((id) => page.locator(`[data-question="${id}"]`));
  for (const el of novo) await expect(el).toBeHidden();

  // SIM: número (com o teclado já nele) e leitura do medidor novo, recuados.
  await marcar(page, 'novoMedidor', 'Sim');
  for (const el of novo) await expect(el).toBeVisible();
  await expect(page.locator('#q-novoMedidorNum')).toBeFocused();
  await expect(novo[0]!).toHaveClass(/ml-6/);
  await page.locator('#q-novoMedidorNum').fill('n62123');
  await page.locator('#q-novoLeitura').fill('0');

  // NÃO: os campos do novo somem e o que foi digitado neles não vale.
  await marcar(page, 'novoMedidor', 'Não');
  for (const el of novo) await expect(el).toBeHidden();
  await salvar(page);
  await page.getByRole('button', { name: 'Ver respostas OS 55' }).click();
  const respostas = page.getByRole('dialog');
  await expect(respostas).toContainText('UC777');
  await expect(respostas).not.toContainText('N62123');
});

test('eletricistas: cadastro igual ao dos técnicos, lista com o nome, matrícula ao lado e Solo/Dupla', async ({ page }) => {
  await page.goto('/');
  // Sem dupla no turno anterior: começa em Solo, com o Eletricista 2 escondido.
  await expect(page.locator('[data-modo="Solo"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#eletricista2')).toBeHidden();
  // Matrícula é obrigatória no cadastro.
  await page.locator('#btn-eletricistas').click();
  await page.locator('#eletricista-nome').fill('Sem Matricula');
  await page.getByRole('button', { name: 'Adicionar eletricista' }).click();
  await expect(page.getByRole('status').last()).toContainText('Digite a matrícula');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();

  await cadastrarEletricistas(page, ['Ana Lima', '111'], ['Bia Souza', '222'], ['Caio Rocha', '333']);
  await expect(page.locator('#eletricista1 option')).toHaveText(['Escolha o eletricista', 'ANA LIMA', 'BIA SOUZA', 'CAIO ROCHA']);
  await page.locator('#eletricista1').selectOption({ label: 'ANA LIMA' });
  // Matrícula em campo separado, ao lado do nome.
  await expect(page.locator('#matricula1')).toHaveValue('111');
  await page.locator('[data-modo="Dupla"]').click();
  await expect(page.locator('#eletricista2')).toBeVisible();
  await page.getByLabel('Início *').fill('07:00');
  await page.getByLabel('Fim *').fill('17:00');
  await escolherLider(page);
  // Dupla sem o segundo: não inicia.
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.getByRole('alert')).toContainText('Escolha o Eletricista 2');
  await expect(page.locator('#eletricista2')).toHaveClass(/faltando/); // caixa vermelha
  // Quem está no Eletricista 1 não aparece no 2, e vice-versa.
  await expect(page.locator('#eletricista2 option')).toHaveText(['Escolha o eletricista', 'BIA SOUZA', 'CAIO ROCHA']);
  await page.locator('#eletricista2').selectOption({ label: 'BIA SOUZA' });
  await expect(page.locator('#eletricista1 option')).toHaveText(['Escolha o eletricista', 'ANA LIMA', 'CAIO ROCHA']);
  await expect(page.locator('#eletricista1 option:checked')).toHaveText('ANA LIMA');
  await expect(page.locator('#eletricista2')).not.toHaveClass(/faltando/);
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.getByTestId('header-info').locator('dd')).toHaveText(['ANA LIMA', '111', 'BIA SOUZA', '222', '-', '-', '-']);

  // Editar: volta em Dupla com os dois escolhidos; Solo tira o Eletricista 2.
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.locator('[data-modo="Dupla"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#eletricista2 option:checked')).toHaveText('BIA SOUZA');
  await page.locator('[data-modo="Solo"]').click();
  await page.getByRole('button', { name: /Salvar cabeçalho/ }).click();
  await expect(page.getByTestId('header-info').locator('dt')).toHaveText(['Eletricista 1', 'Matrícula', 'Equipe', 'Viatura', 'Bodycam']);

  // Excluir do cadastro quem está escolhido: a lista volta para "Escolha o eletricista" (não fica escolhido escondido).
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.locator('#btn-eletricistas').click();
  await page.getByRole('button', { name: 'Excluir eletricista ANA LIMA' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.locator('#eletricista1 option:checked')).toHaveText('Escolha o eletricista');
});

test('OS comercial salva antes da DITAIS valer na comercial: selo "falta DITAIS", aviso no PDF e o lápis pede', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ferracine_prod:v3')) return;
    const h = { nome1: 'ANA', mat1: '1', nome2: '', mat2: '', equipe: '', viatura: '', data: '2026-11-20', horaInicio: '07:00', horaFim: '17:00', bodycam1: '', bodycam2: '', lider: '' };
    const os = { id: 'velha', osNumber: '77', serviceType: 'COMERCIAL', serviceCode: '28', answers: { tipo: { kind: 'text', value: 'RELIGA' } }, registradaEm: '2026-11-20T10:00:00.000Z' };
    localStorage.setItem('ferracine_prod:v3', JSON.stringify({ version: 3, header: h, ordens: [os], draft: null, sheets: [], lastHeader: h, tecnicos: [], eletricistas: [] }));
  });
  await page.route('https://api.github.com/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByTestId('os-item')).toContainText('falta DITAIS');
  await page.locator('#btn-finish').click();
  await expect(page.getByRole('dialog')).toContainText('1 OS está sem a resposta dos DITAIS');
  await expect(page.getByRole('dialog')).toContainText('Sem técnico líder'); // dado antigo, sem líder
  await page.getByRole('dialog').getByRole('button', { name: 'Voltar e corrigir' }).click();
  await page.getByRole('button', { name: 'Editar OS 77' }).click();
  await salvar(page);
  await expect(page.locator('[data-question="ditais"]')).toHaveClass(/faltando/);
  await marcar(page, 'ditais', 'Não');
  await salvar(page);
  await expect(page.getByTestId('os-item')).not.toContainText('falta DITAIS');
});

test('eletricista do turno anterior fora do cadastro aparece marcado e sem matrícula não inicia', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ferracine_prod:v3')) return;
    const h = { nome1: 'ZÉ ANTIGO', mat1: '', nome2: '', mat2: '', equipe: '', viatura: '', data: '2026-11-20', horaInicio: '07:00', horaFim: '17:00', bodycam1: '', bodycam2: '', lider: '' };
    localStorage.setItem('ferracine_prod:v3', JSON.stringify({ version: 3, header: null, ordens: [], draft: null, sheets: [], lastHeader: h, tecnicos: [], eletricistas: [] }));
  });
  await page.goto('/');
  await expect(page.locator('#eletricista1 option:checked')).toHaveText('ZÉ ANTIGO (turno anterior)');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.getByRole('alert')).toContainText('está sem matrícula');
  await expect(page.locator('#matricula1')).toHaveClass(/faltando/);
});

test('cadastrar o eletricista do turno anterior mantém ele escolhido (agora pelo cadastro)', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ferracine_prod:v3')) return;
    const h = { nome1: 'ZÉ ANTIGO', mat1: '777', nome2: '', mat2: '', equipe: '', viatura: '', data: '2026-11-20', horaInicio: '07:00', horaFim: '17:00', bodycam1: '', bodycam2: '', lider: '' };
    localStorage.setItem('ferracine_prod:v3', JSON.stringify({ version: 3, header: null, ordens: [], draft: null, sheets: [], lastHeader: h, tecnicos: [], eletricistas: [] }));
  });
  await page.goto('/');
  await expect(page.locator('#eletricista1 option:checked')).toHaveText('ZÉ ANTIGO (turno anterior)');
  await page.locator('#btn-eletricistas').click();
  await page.locator('#eletricista-nome').fill('zé antigo');
  await page.locator('#eletricista-matricula').fill('777');
  await page.getByRole('button', { name: 'Adicionar eletricista' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.locator('#eletricista1 option:checked')).toHaveText('ZÉ ANTIGO');
  await expect(page.locator('#matricula1')).toHaveValue('777');
});

test('aviso "Salvo em Downloads" com nome de arquivo comprido não vaza para fora do aviso', async ({ page }) => {
  const nome = 'CARLOS_ALBERTO_NUNES_DIEGO_MARTINS_COSTA_21-11-2026_30_servicos (1).pdf';
  // APK simulado: o Android salvou com outro nome (" (1)"), e o aviso mostra o nome que ficou em Downloads.
  await page.addInitScript((salvo) => {
    (window as unknown as Record<string, unknown>).FerracineAndroid = {
      saveFile: () => `salvo:${salvo}`,
      openFile: () => '',
      shareFile: () => '',
      setSystemBars: () => undefined,
      installUpdate: () => '',
    };
  }, nome);
  await page.route('https://api.github.com/**', (route) => route.abort());
  await iniciarTurno(page);
  await page.locator('#btn-finish').click();
  await page.getByRole('button', { name: 'Encerrar mesmo assim' }).click();
  await page.getByTestId('last-sheet').first().getByRole('button', { name: 'Baixar PDF' }).click(); // só baixa ao pedir
  const aviso = page.getByRole('status').filter({ hasText: nome });
  await expect(aviso).toBeVisible();
  expect(await aviso.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('teclado em maiúsculas: campos abrem com caps e o texto digitado vira maiúsculas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Equipe', { exact: true })).toHaveAttribute('autocapitalize', 'characters');
  await page.getByLabel('Equipe', { exact: true }).pressSequentially('josé');
  await expect(page.getByLabel('Equipe', { exact: true })).toHaveValue('JOSÉ');
});

test('cabeçalho do turno: uma informação por linha (eletricistas separados)', async ({ page }) => {
  await page.goto('/');
  await cadastrarEletricistas(page, ['Ana', '1'], ['Bia', '2']);
  await page.locator('#eletricista1').selectOption({ label: 'ANA' });
  await page.locator('[data-modo="Dupla"]').click();
  await page.locator('#eletricista2').selectOption({ label: 'BIA' });
  await page.getByLabel('Início *').fill('07:00');
  await page.getByLabel('Fim *').fill('17:00');
  await escolherLider(page);
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  const linhas = page.getByTestId('header-info').locator('dt');
  await expect(linhas).toHaveText(['Eletricista 1', 'Matrícula', 'Eletricista 2', 'Matrícula', 'Equipe', 'Viatura', 'Bodycam']);
  await expect(page.getByTestId('header-info').locator('dd').nth(2)).toHaveText('BIA');
  await expect(page.getByTestId('header-info').locator('dd').nth(3)).toHaveText('2');
  // Gravado em maiúsculas mesmo que o valor tenha entrado sem passar pela digitação (ex.: turno anterior).
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Equipe', { exact: true }).evaluate((el) => ((el as HTMLInputElement).value = 'pvh-02'));
  await page.getByRole('button', { name: /Salvar cabeçalho/ }).click();
  await expect(page.getByTestId('header-info')).toContainText('PVH-02');
});

test('encerrar avisa quando uma folha não baixada vai sair do histórico (só 4 ficam)', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ferracine_prod:v3')) return;
    const h = (nome: string) => ({ nome1: nome, mat1: '1', nome2: '', mat2: '', equipe: '', viatura: '', data: '2026-11-20', horaInicio: '07:00', horaFim: '17:00', bodycam1: '', bodycam2: '', lider: 't1' });
    const sheets = [4, 3, 2, 1].map((n) => ({ header: h(`TURNO ${n}`), ordens: [], fechadaEm: 'x', tecnicos: [], baixadaEm: n === 1 ? '' : 'x' }));
    const os = { id: 'a', osNumber: '1', serviceType: 'COMERCIAL', serviceCode: '28', answers: { ditais: { kind: 'choice', choice: 'Não' } }, registradaEm: 'x' };
    localStorage.setItem('ferracine_prod:v3', JSON.stringify({ version: 3, header: h('ATUAL'), ordens: [os], draft: null, sheets, lastHeader: h('ATUAL'), tecnicos: [{ id: 't1', nome: 'TEC', telefone: '1' }], eletricistas: [] }));
  });
  await page.route('https://api.github.com/**', (route) => route.abort());
  await page.goto('/');
  await page.locator('#btn-finish').click();
  await expect(page.getByRole('dialog')).toContainText('TURNO 1');
  await expect(page.getByRole('dialog')).toContainText('não foi baixada e sai do histórico');
});

test('histórico: guarda as 4 últimas folhas encerradas, a mais recente primeiro', async ({ page }) => {
  // Já há 4 folhas no aparelho (TURNO 4 é a mais recente); encerrar mais um turno tira a mais antiga.
  await page.addInitScript(() => {
    if (localStorage.getItem('ferracine_prod:v3')) return; // só na primeira carga
    const header = (nome: string) => ({ nome1: nome, mat1: '1', nome2: '', mat2: '', equipe: '', viatura: '', data: '2026-11-20', horaInicio: '07:00', horaFim: '17:00', bodycam1: '', bodycam2: '', lider: '' });
    const sheets = [4, 3, 2, 1].map((n) => ({ header: header(`TURNO ${n}`), ordens: [], fechadaEm: 'x', tecnicos: [] }));
    localStorage.setItem('ferracine_prod:v3', JSON.stringify({ version: 3, header: null, ordens: [], draft: null, sheets, lastHeader: null, tecnicos: [] }));
  });
  await page.goto('/');
  await escolherEletricista1(page, 'Turno 5', '1');
  await escolherLider(page);
  await page.getByLabel('Início *').fill('07:00');
  await page.getByLabel('Fim *').fill('17:00');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await page.locator('#btn-finish').click();
  await page.getByRole('button', { name: 'Encerrar mesmo assim' }).click();

  const folhas = page.getByTestId('last-sheet');
  await expect(page.getByTestId('last-sheets')).toContainText('Últimas 4 folhas encerradas');
  await expect(folhas).toHaveText([/TURNO 5/, /TURNO 4/, /TURNO 3/, /TURNO 2/]); // o turno 1 saiu
  // Cada folha baixa o próprio PDF.
  const download = page.waitForEvent('download');
  await folhas.nth(2).getByRole('button', { name: 'Baixar PDF' }).click();
  expect((await download).suggestedFilename()).toBe('TURNO_3_20-11-2026_0_servicos.pdf');
  // A hora do encerramento separa folhas do mesmo dia.
  await expect(folhas.first()).toContainText(/\d{2}:\d{2}/);
});

test('falta preencher: a caixa fica vermelha (código, DITAIS, cadastro e cabeçalho) e volta ao normal ao mexer', async ({ page }) => {
  await page.goto('/');
  // Cabeçalho: sem eletricista e sem horário.
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  for (const id of ['#eletricista1', '#horaInicio', '#horaFim', '#lider']) await expect(page.locator(id)).toHaveClass(/faltando/);
  await page.getByLabel('Início *').fill('07:00');
  await expect(page.locator('#horaInicio')).not.toHaveClass(/faltando/);
  // Cadastro de eletricista sem matrícula.
  await page.locator('#btn-eletricistas').click();
  await page.locator('#eletricista-nome').fill('ANA');
  await page.getByRole('button', { name: 'Adicionar eletricista' }).click();
  await expect(page.locator('#eletricista-matricula')).toHaveClass(/faltando/);
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();

  // OS: sem código e sem DITAIS.
  await iniciarTurno(page);
  await page.locator('#btn-new-ocorrencia').click();
  await salvar(page);
  await expect(page.locator('#os-code')).toHaveClass(/faltando/);
  await page.locator('#os-code').fill('508');
  await expect(page.locator('#os-code')).not.toHaveClass(/faltando/);
  await salvar(page);
  await expect(page.locator('[data-question="ditais"]')).toHaveClass(/faltando/);
  await marcar(page, 'ditais', 'Não');
  await expect(page.locator('[data-question="ditais"]')).not.toHaveClass(/faltando/);
});

test('histórico: baixar, abrir, excluir e editar (reabre como turno e volta ao topo ao encerrar)', async ({ page, context }) => {
  await iniciarTurno(page);
  await novaOS(page, 'comercial', '709', '111');
  await salvar(page);
  await page.locator('#btn-finish').click(); // sem pendência: encerra direto
  await expect(page.locator('#screen-header')).toBeVisible();
  const folha = page.getByTestId('last-sheet').first();
  await expect(folha).toContainText('1 OS');

  // Baixar e abrir o PDF de novo.
  const download = page.waitForEvent('download');
  await folha.getByRole('button', { name: 'Baixar PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/_1_servico\.pdf$/);
  const aba = context.waitForEvent('page');
  await folha.getByRole('button', { name: 'Abrir PDF' }).click();
  await (await aba).close();

  // Editar: a folha volta a ser o turno aberto, com a OS; sai do histórico.
  await folha.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('volta a ser o turno aberto');
  await page.getByRole('button', { name: 'Editar folha' }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await expect(page.getByTestId('os-item')).toContainText('OS 111');
  // A folha reaberta saiu do histórico (o do topo fica vazio até encerrar de novo).
  await page.locator('#historico-toggle').click();
  await expect(page.getByRole('dialog')).toContainText('Nenhuma folha encerrada');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  // Corrige e encerra de novo: volta ao topo do histórico, com as 2 OSs.
  await novaOS(page, 'ocorrencia', '508', '222');
  await salvar(page);
  await page.locator('#btn-finish').click();
  await expect(page.getByTestId('last-sheet')).toHaveCount(1);
  await expect(page.getByTestId('last-sheet').first()).toContainText('2 OSs');

  // Botão do topo: a mesma lista; Editar desativado com turno aberto. (Turno novo já vem com a equipe; só o líder.)
  await page.locator('#lider').selectOption({ label: 'TEC. LIDER - 69 90000-0000' });
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await page.locator('#historico-toggle').click();
  await expect(page.getByRole('dialog').getByTestId('last-sheet')).toHaveCount(1);
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Editar', exact: true })).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();

  // Excluir pede confirmação.
  await page.locator('#historico-toggle').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('O PDF já baixado no celular não é apagado');
  // Excluir é perigoso: o foco começa no Cancelar.
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click();
  // Depois de excluir, a janela do histórico volta (agora vazia).
  await expect(page.getByRole('dialog')).toContainText('Nenhuma folha encerrada');
});

test('excluir uma folha pelo cartão da tela inicial não apaga o que já foi digitado no cabeçalho', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('ferracine_prod:v3')) return;
    const header = (nome: string) => ({ nome1: nome, mat1: '1', nome2: '', mat2: '', equipe: '', viatura: '', data: '2026-11-20', horaInicio: '07:00', horaFim: '17:00', bodycam1: '', bodycam2: '', lider: '' });
    const sheets = ['A', 'B'].map((n) => ({ header: header(`TURNO ${n}`), ordens: [], fechadaEm: 'x', tecnicos: [] }));
    localStorage.setItem('ferracine_prod:v3', JSON.stringify({ version: 3, header: null, ordens: [], draft: null, sheets, lastHeader: null, tecnicos: [] }));
  });
  await page.goto('/');
  await page.getByLabel('Equipe', { exact: true }).fill('DIGITADO');
  await page.getByTestId('last-sheet').first().getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByTestId('last-sheet')).toHaveCount(1);
  await expect(page.getByTestId('last-sheet')).toContainText('TURNO B');
  await expect(page.getByLabel('Equipe', { exact: true })).toHaveValue('DIGITADO');
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

test('temas: o botão abre a lista (Moderno, Retrô 98, Windows 3.1); escolha fica salva e combina com claro/escuro', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const card = page.locator('#screen-header .card').first();
  const estilo = (prop: string) => card.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  const escolher = async (nome: string) => {
    await page.locator('#estilo-toggle').click();
    await expect(page.getByRole('dialog')).toContainText('Escolha o tema');
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(nome) }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  };
  // Padrão: Tema 1, cantos arredondados; a lista mostra os 3 e marca o atual.
  await expect(html).toHaveAttribute('data-estilo', 'moderno');
  expect(await estilo('border-radius')).not.toBe('0px');
  await page.locator('#estilo-toggle').click();
  await expect(page.locator('[data-estilo-opcao]')).toHaveCount(3);
  await expect(page.locator('[data-estilo-opcao="moderno"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(html).toHaveAttribute('data-estilo', 'moderno'); // abrir a lista não troca nada

  // Tema 2: cantos retos e relevo; o claro/escuro continua independente.
  await escolher('Tema 2: Retrô 98');
  await expect(html).toHaveAttribute('data-estilo', 'retro');
  expect(await estilo('border-radius')).toBe('0px');
  expect(await estilo('box-shadow')).toContain('inset');
  const fundoClaro = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.locator('#theme-toggle').click();
  await expect(html).toHaveAttribute('data-estilo', 'retro');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(fundoClaro);

  // Tema 3: moldura sólida, sem relevo no cartão.
  await escolher('Tema 3: Windows 3.1');
  await expect(html).toHaveAttribute('data-estilo', 'win31');
  expect(await estilo('border-radius')).toBe('0px');
  expect(await estilo('border-top-width')).toBe('1px');
  expect(await estilo('box-shadow')).toBe('none');
  // Barra de título com a moldura embaixo (o bloco comum não pode apagar a borda do Windows 3.1).
  await page.locator('#estilo-toggle').click();
  expect(await page.locator('.janela-titulo').evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('1px');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();

  // Fica salvo (o script do <head> aplica antes da pintura).
  const tema = await html.getAttribute('data-theme');
  await page.reload();
  await expect(html).toHaveAttribute('data-estilo', 'win31');
  await expect(html).toHaveAttribute('data-theme', tema!);
  await escolher('Tema 1: Moderno');
  await expect(html).toHaveAttribute('data-estilo', 'moderno');
});

test('OS em preenchimento sobrevive ao recarregar a página', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, 'comercial', '28', '789');
  await page.locator('#q-tipo').fill('VISTORIA');
  await marcar(page, 'clientePresente', 'Não');
  await page.reload();
  await expect(page.locator('#screen-os[data-mode="new"]')).toBeVisible();
  await expect(page.locator('#os-number')).toHaveValue('789');
  await expect(page.locator('#os-code')).toHaveValue('28');
  await expect(page.locator('#q-tipo')).toHaveValue('VISTORIA');
  await expect(page.locator('[data-question="clientePresente"] [data-choice="Não"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#screen-os').getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Descartar OS' }).click();
  await expect(page.getByTestId('os-item')).toHaveCount(0);
});

test('voltar do Android na correção do cabeçalho cancela a correção (não fecha o app)', async ({ page }) => {
  await iniciarTurno(page);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Equipe', { exact: true }).fill('OUTRA');
  await page.goBack();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await expect(page.getByTestId('header-info')).toContainText('PVH-01');
  await expect.poll(() => page.evaluate(() => history.state?.ferracineBackTrap ?? false)).toBe(false);
});

test('salvar a OS e abrir outra na hora: a nova continua aberta (o voltar atrasado da anterior não a cancela)', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, 'comercial', '28', '1');
  await marcar(page, 'novoMedidor', 'Não');
  await page.locator('#btn-os-save').click();
  await page.locator('#btn-new-ocorrencia').click();
  await expect(page.locator('#screen-os[data-mode="new"]')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('#screen-os[data-mode="new"]')).toBeVisible();
  // E o voltar do sistema continua sendo o Cancelar da OS nova (em branco: volta direto).
  await page.goBack();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await expect(page.getByTestId('os-item')).toHaveCount(1);
});

test('editar o cabeçalho mantém a folha', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, 'comercial', '28', '1');
  await salvar(page);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await escolherEletricista1(page, 'João Souza', '123456');
  await page.getByRole('button', { name: /Salvar cabeçalho/ }).click();
  await expect(page.getByTestId('header-info')).toContainText('JOÃO SOUZA');
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
