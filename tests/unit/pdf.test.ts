import { describe, expect, it } from 'vitest';
import { TECNICOS_LIDERES } from '../../src/domain/catalog';
import type { OrdemServico, ShiftHeader } from '../../src/domain/types';
import * as wiz from '../../src/domain/wizard';
import { buildSheetPdf, drawEspelho, newSheetDoc } from '../../src/pdf';
import { baseHeader, finishedOS } from './fixtures';

const header: ShiftHeader = {
  ...baseHeader,
  nome1: 'Carlos Pereira',
  mat1: '111222',
  nome2: 'Marcos Lima',
  mat2: '333444',
  equipe: 'PVH-01',
  viatura: 'ABC1D23',
  bodycam1: 'BC-07',
  bodycam2: 'BC-08',
  lider: TECNICOS_LIDERES[1]!,
};

function ocorrencia(n: number): OrdemServico {
  return finishedOS(
    String(900000 + n),
    'OCORRENCIA',
    '508',
    { o1: { kind: 'text', value: 'Falta de energia' }, o6: { kind: 'choice', choice: 'Sim' }, o12: { kind: 'choice', choice: 'Sim', detail: `MED-${n}` } },
    `id-${n}`,
  );
}

/** jsPDF grava o texto sem compressão e com acentos em latin-1: dá para procurar strings direto no arquivo. */
function pdfText(doc: ReturnType<typeof buildSheetPdf>): string {
  return doc.output();
}

describe('PDF do Espelho de Campo', () => {
  it('segue o modelo: identificação, tabela de serviços, produção total e técnico líder', () => {
    const comercial = wiz.finalize(wiz.setText(wiz.startDraft('123', 'COMERCIAL', '709'), 'Corte'), 'c', new Date());
    const doc = buildSheetPdf(header, [comercial, ocorrencia(1)], new Date('2026-11-20T20:00:00Z'));
    const text = pdfText(doc);
    const expected = [
      'GRUPO ENERGISA',
      'DEPARTAMENTO DE OPERAÇÃO',
      'ESPELHO DE CAMPO',
      'Carlos Pereira',
      'MAT: 111222',
      'EQUIPE: PVH-01',
      'VIATURA: ABC1D23',
      '20/11/2026',
      '07:00 às 17:00',
      'BODYCAM2:',
      'BC-08',
      'OS/OCORRÊNCIA',
      'INFORMAÇÕES DESVIOS',
      '709 - Corte',
      '508 - Falta de energia',
      'MED-1',
      'TEC.LIDER RESPONSAVEL PELA EQUIPE',
      'PRODUÇÃO TOTAL: 2',
      `[X] ${TECNICOS_LIDERES[1]}`,
      `[ ] ${TECNICOS_LIDERES[0]}`,
      'DETALHAMENTO DAS ORDENS DE SERVI',
      'OS: 900001',
      'Página 2 de 2',
    ];
    for (const s of expected) expect(text).toContain(s);
    expect(doc.getNumberOfPages()).toBe(2);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 0);
  });

  it('folha em branco: 20 linhas vazias, produção zero e sem anexo', () => {
    const doc = buildSheetPdf({ ...header, nome2: '', bodycam2: '', lider: '' }, [], new Date());
    const text = pdfText(doc);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(text).toContain('(20) Tj');
    expect(text).not.toContain('(21) Tj');
    expect(text).toContain('PRODUÇÃO TOTAL: 0');
    expect(text).not.toContain('[X]');
  });

  it('com 20 OSs de textos longos o espelho continua numa folha só', () => {
    const longo = 'Religação de unidade consumidora com troca de ramal e disjuntor danificado pela chuva';
    const ordens = Array.from({ length: 20 }, (_, i) => {
      const sim = { kind: 'choice', choice: 'Sim', detail: longo } as const;
      return finishedOS(`OS-${'9'.repeat(20)}-${i}`, 'OCORRENCIA', '508', { o1: { kind: 'text', value: longo }, o11: sim, o18: sim }, `id-${i}`);
    });
    const doc = newSheetDoc();
    drawEspelho(doc, { ...header, nome1: longo, equipe: longo, viatura: longo }, ordens);
    expect(doc.getNumberOfPages()).toBe(1);
    // O texto completo continua no detalhamento, sem corte.
    expect(pdfText(buildSheetPdf(header, ordens, new Date()))).toContain(longo);
  });

  it('mais de 20 OSs: a tabela cresce e todas as páginas são numeradas', () => {
    const ordens = Array.from({ length: 23 }, (_, i) => ocorrencia(i));
    const doc = buildSheetPdf(header, ordens, new Date());
    const text = pdfText(doc);
    const pages = doc.getNumberOfPages();
    expect(text).toContain('(23) Tj');
    expect(text).toContain('PRODUÇÃO TOTAL: 23');
    expect(text).toContain(`Página ${pages} de ${pages}`);
  });
});
