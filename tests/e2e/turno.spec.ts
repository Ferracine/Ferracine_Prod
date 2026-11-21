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
  await page.getByLabel('Nome 1 *').fill('JOÃO DA SILVA');
  await page.getByLabel('Mat. 1 *').fill('123456');
  await page.getByLabel('Equipe', { exact: true }).fill('PVH-01');
  await page.getByLabel('Início *').fill('07:00');
  await page.getByLabel('Fim *').fill('17:00');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
}

/** "+" Comercial ou "+" Ocorrência → tela da OS em branco; preenche código e número. */
async function novaOS(page: Page, tipo: 'comercial' | 'ocorrencia', codigo: string, numero = '') {
  await page.locator(`#btn-new-${tipo}`).click();
  await expect(page.locator('#screen-os[data-mode="new"]')).toBeVisible();
  await page.locator('#os-code').fill(codigo);
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
  await expect(page.getByTestId('header-info')).toContainText('JOÃO DA SILVA (Mat: 123456)');
  await expect(page.getByText('© Ferracine Prod')).toBeVisible();

  // Comercial sem número (S/N): a tela da OS traz as 12 perguntas de uma vez.
  await novaOS(page, 'comercial', '709');
  await expect(page.locator('#os-number')).toHaveValue('');
  await expect(page.locator('#os-code')).toHaveValue('709');
  await expect(page.locator('#screen-os [data-question]:visible')).toHaveCount(11);
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
  await novaOS(page, 'ocorrencia', '508', '456');
  await expect(page.locator('#screen-os [data-question]')).toHaveCount(13);
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
  const hojeBR = await page.evaluate(() => new Date().toLocaleDateString('pt-BR').replaceAll('/', '-'));
  expect((await download).suggestedFilename()).toBe(`JOAO_DA_SILVA_${hojeBR}_2_servicos.pdf`);
  await expect(page.getByRole('dialog')).toContainText('PDF gerado');
  await page.getByRole('button', { name: 'Encerrar turno' }).click();

  // Próximo turno: dados da equipe já preenchidos, data de hoje e técnico líder em branco.
  await expect(page.locator('#screen-header')).toBeVisible();
  await expect(page.getByLabel('Nome 1 *')).toHaveValue('JOÃO DA SILVA');
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
  expect((await last).suggestedFilename()).toBe(`JOAO_DA_SILVA_${hojeBR}_2_servicos.pdf`);
});

test('dois "+": Comercial e Ocorrência abrem a tela da OS em branco com as perguntas de cada tipo', async ({ page }) => {
  await iniciarTurno(page);
  await expect(page.getByText('Registrar nova Ordem de Serviço')).toHaveCount(0);

  await page.locator('#btn-new-comercial').click();
  await expect(page.locator('#screen-os[data-mode="new"]')).toContainText('COMERCIAL');
  await expect(page.locator('#os-number')).toHaveValue('');
  await expect(page.locator('#os-code')).toHaveValue('');
  await expect(page.locator('#screen-os [data-question]:visible')).toHaveCount(11);
  await expect(page.locator('#q-tipo')).toHaveValue('');
  // Sem código não salva: avisa e leva ao campo.
  await salvar(page);
  await expect(page.getByRole('status').last()).toContainText('Informe o código');
  await expect(page.locator('#os-code')).toBeFocused();
  // Código da Ocorrência no "+ Comercial": não salva e indica o "+" certo.
  await page.locator('#os-code').fill('508');
  await salvar(page);
  await expect(page.getByRole('status').last()).toContainText('use o + OCORRÊNCIA');
  await expect(page.getByLabel('Número da OS comercial')).toBeVisible();
  await page.locator('#screen-os').getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Descartar OS' }).click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();
  await expect(page.getByTestId('os-item')).toHaveCount(0);

  await page.locator('#btn-new-ocorrencia').click();
  await expect(page.locator('#screen-os[data-mode="new"]')).toContainText('OCORRÊNCIA');
  await expect(page.getByLabel('Número da ocorrência')).toBeVisible();
  await expect(page.locator('#screen-os [data-question="ditais"]')).toContainText('obrigatória');
  // Qualquer código vale (fora da lista também).
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
  await marcar(page, 'dificuldade', 'Sim');
  // SIM sem complemento: não salva.
  await salvar(page);
  await expect(page.getByRole('status').last()).toContainText('preencha o complemento');
  await page.locator('[data-question="dificuldade"] input').fill('CHUVA FORTE');
  await salvar(page);

  await expect(page.getByTestId('os-item')).toContainText('Cód. 798');
  await page.getByRole('button', { name: 'Ver respostas OS 321' }).click();
  for (const t of ['RELIGAÇÃO', '45210', 'Sim — CHUVA FORTE']) await expect(page.getByRole('dialog')).toContainText(t);
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
  await page.getByLabel('Nome 1 *').fill('MARIA');
  await cadastrarTecnico(page, 'TEC. TRES', '69 3333-3333');
  await expect(page.getByLabel('Nome 1 *')).toHaveValue('MARIA');
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
  await page.getByRole('button', { name: 'Corrigir' }).click();
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

test('eletricistas: cadastrar e escolher preenche nome e matrícula', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btn-eletricistas').click();
  for (const [nome, mat] of [['Ana Lima', '111'], ['Bia Souza', '222']] as const) {
    await page.locator('#eletricista-nome').fill(nome);
    await page.locator('#eletricista-matricula').fill(mat);
    await page.getByRole('button', { name: 'Adicionar eletricista' }).click();
  }
  await expect(page.getByTestId('eletricistas-list')).toContainText('BIA SOUZA');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();

  await page.locator('#eletricista2').selectOption({ label: 'BIA SOUZA (Mat: 222)' });
  await expect(page.getByLabel('Nome 2')).toHaveValue('BIA SOUZA');
  await expect(page.getByLabel('Mat. 2')).toHaveValue('222');
  // Excluir tira da lista de escolha.
  await page.locator('#btn-eletricistas').click();
  await page.getByRole('button', { name: 'Excluir eletricista ANA LIMA' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.locator('#eletricista1 option')).toHaveText(['Escolher eletricista cadastrado…', 'BIA SOUZA (Mat: 222)']);
});

test('aviso "PDF salvo" com nome de arquivo comprido não vaza para fora do aviso', async ({ page }) => {
  const nome = 'CARLOS_ALBERTO_NUNES_DIEGO_MARTINS_COSTA_21-11-2026_30_servicos (1).pdf';
  // APK simulado: o Android salvou com outro nome (" (1)"), e o aviso mostra o nome que ficou em Downloads.
  await page.addInitScript((salvo) => {
    (window as unknown as Record<string, unknown>).FerracineAndroid = {
      savePdf: () => `salvo:${salvo}`,
      openPdf: () => '',
      sharePdf: () => '',
      setSystemBars: () => undefined,
      installUpdate: () => '',
    };
  }, nome);
  await page.route('https://api.github.com/**', (route) => route.abort());
  await iniciarTurno(page);
  await page.locator('#btn-finish').click();
  await page.getByRole('button', { name: 'Gerar mesmo assim' }).click();
  const aviso = page.getByRole('status').filter({ hasText: nome });
  await expect(aviso).toBeVisible();
  expect(await aviso.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('teclado em maiúsculas: campos abrem com caps e o texto digitado vira maiúsculas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Nome 1 *')).toHaveAttribute('autocapitalize', 'characters');
  await page.getByLabel('Nome 1 *').pressSequentially('josé');
  await expect(page.getByLabel('Nome 1 *')).toHaveValue('JOSÉ');
});

test('cabeçalho do turno: uma informação por linha (eletricistas separados)', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Nome 1 *').fill('ANA');
  await page.getByLabel('Mat. 1 *').fill('1');
  await page.getByLabel('Nome 2').fill('BIA');
  await page.getByLabel('Mat. 2').fill('2');
  await page.getByLabel('Início *').fill('07:00');
  await page.getByLabel('Fim *').fill('17:00');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  const linhas = page.getByTestId('header-info').locator('dt');
  await expect(linhas).toHaveText(['Eletricista 1', 'Eletricista 2', 'Equipe', 'Viatura', 'Bodycam']);
  await expect(page.getByTestId('header-info').locator('dd').nth(1)).toHaveText('BIA (Mat: 2)');
  // Gravado em maiúsculas mesmo que o valor tenha entrado sem passar pela digitação (ex.: turno anterior).
  await page.getByRole('button', { name: 'Corrigir' }).click();
  await page.getByLabel('Equipe', { exact: true }).evaluate((el) => ((el as HTMLInputElement).value = 'pvh-02'));
  await page.getByRole('button', { name: /Salvar cabeçalho/ }).click();
  await expect(page.getByTestId('header-info')).toContainText('PVH-02');
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
  await page.getByLabel('Nome 1 *').fill('TURNO 5');
  await page.getByLabel('Mat. 1 *').fill('1');
  await page.getByLabel('Início *').fill('07:00');
  await page.getByLabel('Fim *').fill('17:00');
  await page.getByRole('button', { name: /Iniciar turno/ }).click();
  await page.locator('#btn-finish').click();
  await page.getByRole('button', { name: 'Gerar mesmo assim' }).click();
  await page.getByRole('button', { name: 'Encerrar turno' }).click();

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

test('corrigir o cabeçalho mantém a folha', async ({ page }) => {
  await iniciarTurno(page);
  await novaOS(page, 'comercial', '28', '1');
  await salvar(page);
  await page.getByRole('button', { name: 'Corrigir' }).click();
  await page.getByLabel('Nome 1 *').fill('JOÃO SOUZA');
  await page.getByRole('button', { name: /Salvar cabeçalho/ }).click();
  await expect(page.getByTestId('header-info')).toContainText('JOÃO SOUZA (Mat: 123456)');
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
