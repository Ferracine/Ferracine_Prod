import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Auditoria de acessibilidade (axe) do painel e da tela da OS em todos os temas, claro e escuro: contraste, títulos, rótulos... */

const ESTILOS = ['moderno', 'floresta', 'sol-forte', 'win98', 'xp', 'win10'] as const;
const cab = { nome1: 'ANA', mat1: '1', nome2: '', mat2: '', equipe: 'E1', viatura: 'V1', data: '2026-11-27', horaInicio: '07:00', horaFim: '17:00', bodycam1: '', bodycam2: '', lider: 't1' };
const os = (n: number, tipo: string) => ({ id: `o${n}`, osNumber: String(n), serviceType: tipo, serviceCode: '709', answers: { ditais: { kind: 'choice', choice: 'Não' } }, registradaEm: '2026-11-27T10:00:00.000Z' });
const DADOS = JSON.stringify({ version: 3, header: cab, ordens: [os(1, 'COMERCIAL'), os(2, 'OCORRENCIA')], draft: null, sheets: [], lastHeader: cab, tecnicos: [{ id: 't1', nome: 'TEC', telefone: '1' }], eletricistas: [], reaberta: null, tecnicosDaReaberta: [] });

for (const estilo of ESTILOS) {
  for (const tema of ['light', 'dark'] as const) {
    test(`acessibilidade do tema ${estilo} (${tema === 'light' ? 'claro' : 'escuro'}): painel e tela da OS sem violações`, async ({ page }) => {
      await page.addInitScript(
        ([dados, estilo, tema]) => {
          localStorage.setItem('ferracine_prod:v3', dados);
          localStorage.setItem('ferracine_prod:estilo', estilo);
          localStorage.setItem('ferracine_prod:theme', tema);
        },
        [DADOS, estilo, tema] as const,
      );
      await page.route('https://api.github.com/**', (route) => route.abort());
      await page.goto('/');
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
      const violacoes = async (tela: string) =>
        (await new AxeBuilder({ page }).analyze()).violations.map((v) => `${tela}: ${v.id} (${v.impact}) em ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      const achadas = [...(await violacoes('painel'))];
      await page.locator('#btn-new-ocorrencia').click();
      await page.locator('[data-question="clientePresente"] [data-choice="Sim"]').click();
      achadas.push(...(await violacoes('tela da OS')));
      expect(achadas).toEqual([]);
    });
  }
}
