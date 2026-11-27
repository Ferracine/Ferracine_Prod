import { expect, test, type Page } from '@playwright/test';

/**
 * Referência de estilos de cada tema (claro e escuro): cores, bordas, biséis, raios e fontes calculados dos elementos
 * principais (painel, botões, janela, campo, escolhas). Uma regra de CSS que perde por especificidade, ou um tema que
 * muda sem querer, muda o arquivo de referência. Sem medidas de tamanho: o resultado é o mesmo no Windows e no Linux.
 * Mudou de propósito? `pnpm test:e2e temas --update-snapshots` e confira a diferença no git.
 */

const ESTILOS = ['moderno', 'floresta', 'sol-forte', 'win98', 'xp', 'win10'] as const;
const PROPS = [
  'color',
  'backgroundColor',
  'backgroundImage',
  'borderTopColor',
  'borderTopWidth',
  'borderTopStyle',
  'borderBottomColor',
  'borderBottomWidth',
  'borderTopLeftRadius',
  'boxShadow',
  'fontFamily',
  'fontWeight',
  'outlineStyle',
  'textShadow',
] as const;

const cabecalho = { nome1: 'ANA', mat1: '1', nome2: '', mat2: '', equipe: 'E1', viatura: 'V1', data: '2026-11-27', horaInicio: '07:00', horaFim: '17:00', bodycam1: '', bodycam2: '', lider: 't1' };
const os = (n: number, tipo: string) => ({ id: `o${n}`, osNumber: String(n), serviceType: tipo, serviceCode: '709', answers: { ditais: { kind: 'choice', choice: 'Não' } }, registradaEm: `2026-11-27T10:0${n}:00.000Z` });
const DADOS = JSON.stringify({
  version: 3,
  header: cabecalho,
  ordens: [os(1, 'COMERCIAL'), os(2, 'OCORRENCIA')],
  draft: null,
  sheets: [{ header: cabecalho, ordens: [], fechadaEm: '2026-11-26T18:00:00.000Z', tecnicos: [], baixadaEm: '' }],
  lastHeader: cabecalho,
  tecnicos: [{ id: 't1', nome: 'TEC', telefone: '1' }],
  eletricistas: [],
  reaberta: null,
  tecnicosDaReaberta: [],
});

async function estilos(page: Page, alvos: Record<string, string>): Promise<Record<string, Record<string, string>>> {
  return page.evaluate(
    ([alvos, props]) =>
      Object.fromEntries(
        Object.entries(alvos).map(([nome, sel]) => {
          const el = document.querySelector(sel);
          if (!el) return [nome, { ausente: sel }];
          const cs = getComputedStyle(el);
          return [nome, Object.fromEntries(props.map((p) => [p, cs[p as keyof CSSStyleDeclaration] as string]))];
        }),
      ),
    [alvos, PROPS] as const,
  );
}

for (const estilo of ESTILOS) {
  for (const tema of ['light', 'dark'] as const) {
    test(`estilos do tema ${estilo} (${tema === 'light' ? 'claro' : 'escuro'}) iguais à referência`, async ({ page }) => {
      await page.addInitScript(
        ([dados, estilo, tema]) => {
          if (sessionStorage.getItem('semeado')) return;
          sessionStorage.setItem('semeado', '1');
          localStorage.setItem('ferracine_prod:v3', dados);
          localStorage.setItem('ferracine_prod:estilo', estilo);
          localStorage.setItem('ferracine_prod:theme', tema);
        },
        [DADOS, estilo, tema] as const,
      );
      await page.route('https://api.github.com/**', (route) => route.abort());
      await page.goto('/');
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
      await expect(page.locator('#screen-dashboard')).toBeVisible();
      const r: Record<string, unknown> = {};
      r.painel = await estilos(page, {
        body: 'body',
        barra: '.barra-app',
        titulo: '.barra-app h1',
        botaoTopo: '#historico-toggle',
        card: '#screen-dashboard .card',
        osItem: '[data-testid="os-item"]',
        seloComercial: '[data-testid="os-item"] span[class*="text-brand-fg"]',
        novaComercial: '#btn-new-comercial',
        novaOcorrencia: '#btn-new-ocorrencia',
        ordem: '#btn-ordem-os',
        encerrar: '#btn-finish',
        cancelar: '#btn-cancel-turno',
        lixeira: '[data-testid="os-item"] .btn-perigo',
        rodape: 'footer',
      });
      await page.locator('#historico-toggle').click();
      r.janela = await estilos(page, {
        janela: '.janela',
        titulo: '.janela-titulo',
        fechar: '.btn-fechar',
        baixar: '[role="dialog"] .btn-primary',
        excluir: '[role="dialog"] .btn-perigo',
        rodape: '.janela-rodape',
      });
      await page.locator('.btn-fechar').click();
      await page.locator('#btn-new-ocorrencia').click();
      await page.locator('[data-question="clientePresente"] [data-choice="Sim"]').click();
      r.os = await estilos(page, {
        campo: '#os-code',
        pergunta: '[data-question="tipo"]',
        escolhaMarcada: '[data-question="clientePresente"] [data-choice="Sim"]',
        escolhaLivre: '[data-question="clientePresente"] [data-choice="Não"]',
        salvar: '#btn-os-save',
      });
      expect(JSON.stringify(r, null, 1)).toMatchSnapshot(`${estilo}-${tema}.json`);
    });
  }
}
