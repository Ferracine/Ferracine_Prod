import { describe, expect, it } from 'vitest';
import type { OrdemServico, ShiftHeader } from '../../src/domain/types';
import * as wiz from '../../src/domain/wizard';
import { buildSheetPdf } from '../../src/pdf';

const header: ShiftHeader = {
  nome1: 'Carlos Pereira',
  mat1: '111222',
  nome2: 'Marcos Lima',
  mat2: '333444',
  data: '2026-11-20',
  horaInicio: '07:00',
  horaFim: '17:00',
  bodycam1: 'BC-07',
};

function ocorrencia(n: number): OrdemServico {
  const d = wiz.startDraft(String(900000 + n), 'OCORRENCIA', '508');
  return wiz.finalize({ ...d, answers: { ...d.answers, o1: { kind: 'text', value: 'Falta de energia' }, o6: { kind: 'choice', choice: 'Sim' } } }, `id-${n}`, new Date());
}

/** jsPDF grava o texto sem compressão; dá para procurar strings direto no arquivo. */
function pdfText(doc: ReturnType<typeof buildSheetPdf>): string {
  return doc.output();
}

describe('PDF da folha', () => {
  it('traz cabeçalho da equipe, resumo e as OSs', () => {
    const comercial = wiz.finalize(wiz.setText(wiz.startDraft('123', 'COMERCIAL', '709'), 'Corte'), 'c', new Date());
    const doc = buildSheetPdf(header, [comercial, ocorrencia(1)], new Date('2026-11-20T20:00:00Z'));
    const text = pdfText(doc);
    expect(doc.getNumberOfPages()).toBe(1);
    for (const s of ['Carlos Pereira', '111222', 'Marcos Lima', '20/11/2026', '07:00 às 17:00', 'BODYCAM 1: BC-07', 'OS: 123', 'OS: 900001', 'Falta de energia', 'Página 1 de 1']) {
      expect(text).toContain(s);
    }
    expect(text).toContain('COMERCIAL: 1');
  });

  it('gera folha em branco e preenche campos opcionais com "-"', () => {
    const text = pdfText(buildSheetPdf({ ...header, nome2: '', mat2: '', bodycam1: '' }, [], new Date()));
    expect(text).toContain('Nenhuma Ordem de Servi');
    expect(text).toContain('BODYCAM 1: -');
  });

  it('quebra páginas com muitas OSs e numera todas', () => {
    const ordens = Array.from({ length: 8 }, (_, i) => ocorrencia(i));
    const doc = buildSheetPdf(header, ordens, new Date());
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(2);
    expect(pdfText(doc)).toContain(`Página ${pages} de ${pages}`);
  });
});
