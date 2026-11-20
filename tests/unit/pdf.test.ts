import { describe, expect, it } from 'vitest';
import { TECNICOS_LIDERES } from '../../src/domain/catalog';
import type { OrdemServico, ShiftHeader } from '../../src/domain/types';
import { buildSheetPdf } from '../../src/pdf';
import { baseHeader, finishedOS } from './fixtures';

const header: ShiftHeader = {
  ...baseHeader,
  nome1: 'Carlos Pereira',
  mat1: '111222',
  nome2: 'Marcos Lima',
  mat2: '333444',
  equipe: 'PVH-01',
  viatura: '3226',
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

describe('PDF do Espelho de Campo (igual ao modelo de papel)', () => {
  it('traz título, identificação, colunas, produção total e técnicos numa folha A4 paisagem', () => {
    const comercial = finishedOS('123', 'COMERCIAL', '709', { c1: { kind: 'text', value: 'Corte' }, c2: { kind: 'choice', choice: 'Sim' } });
    const doc = buildSheetPdf(header, [comercial, ocorrencia(1)]);
    const text = pdfText(doc);
    const expected = [
      'DEPARTAMENTO DE OPERAÇÃO',
      'ESPELHO DE CAMPO',
      '(NOME:)',
      '(Carlos Pereira)',
      '(MAT:)',
      '(111222)',
      '(EQUIPE:)',
      '(PVH-01)',
      '(VIATURA:)',
      '(3226)',
      '(DATA:)',
      '(20/11/2026)',
      '(HORARIO:)',
      '(07:00 às 17:00)',
      '(BODYCAM:)',
      '(BODYCAM2:)',
      '(ITEM)',
      'OS/OCORRÊNCIA',
      'TIPO DE SERVIÇO',
      'MEDIDOR INSTALADO',
      'MEDIDOR RETIRADO',
      'INFO ADICIONAL',
      '(709 - Corte)',
      '(Cliente presente: Sim)',
      '(508 - Falta de energia)',
      '(MED-1)',
      'DITAIS: Sim',
      'TEC.LIDER RESPONSAVEL PELA EQUIPE',
      'PRODUÇÃO TOTAL:',
      '(TEC. BELTRANO SOUZA)',
      '(69 90000-0002)',
      '(TEC. FULANO DE TAL)',
      '/Subtype /Image',
    ];
    for (const s of expected) expect(text).toContain(s);
    expect(text).not.toContain('INFORMAÇÕES DESVIOS');
    expect(text).not.toContain('DETALHAMENTO');
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 0);
  });

  it('folha em branco: 15 linhas numeradas e produção zero', () => {
    const text = pdfText(buildSheetPdf({ ...header, nome2: '', lider: '' }, []));
    expect(text).toContain('(15) Tj');
    expect(text).not.toContain('(16) Tj');
    expect(text).toMatch(/\(0\) Tj/);
  });

  const longo = 'Religação de unidade consumidora com troca de ramal e disjuntor danificado pela chuva';

  it('15 ocorrências com todas as perguntas respondidas cabem numa folha', () => {
    const completa = (i: number) =>
      finishedOS(`16438545${i}`, 'OCORRENCIA', '508', {
        o1: { kind: 'text', value: 'Falta de energia' },
        o3: { kind: 'choice', choice: 'Sim' },
        o4: { kind: 'text', value: 'Fusível queimado' },
        o5: { kind: 'text', value: 'Chave fusível' },
        o6: { kind: 'choice', choice: 'Sim' },
        o7: { kind: 'text', value: '45210' },
        o8: { kind: 'text', value: '45235' },
        o9: { kind: 'text', value: '08:15' },
        o10: { kind: 'text', value: '09:40' },
        o11: { kind: 'choice', choice: 'Não' },
        o12: { kind: 'choice', choice: 'Sim', detail: 'LH-07' },
        o13: { kind: 'choice', choice: 'Sim', detail: 'AB-123456' },
        o14: { kind: 'text', value: '0' },
        o15: { kind: 'text', value: '1543210' },
        o16: { kind: 'text', value: '45235' },
        o17: { kind: 'text', value: '45250' },
        o18: { kind: 'choice', choice: 'Não' },
      }, `id-${i}`);
    const doc = buildSheetPdf(header, Array.from({ length: 15 }, (_, i) => completa(i)));
    expect(doc.getNumberOfPages()).toBe(1);
    // Leitura de 7 dígitos não é cortada na coluna estreita.
    expect(pdfText(doc)).toContain('(1543210)');
  });

  it('nada é cortado: textos longos quebram linha em qualquer coluna', () => {
    const os = finishedOS('1', 'OCORRENCIA', '508', { o1: { kind: 'text', value: longo }, o4: { kind: 'text', value: `${longo} ${longo}` } });
    const text = pdfText(buildSheetPdf(header, [os])).replace(/\) Tj\n[^(]*\(/g, ' ');
    expect(text).not.toContain('...');
    expect(text).toContain(`Defeito: ${longo} ${longo}`);
    expect(text).toContain('chuva');
  });

  it('o rodapé (técnico líder + produção total) nunca se divide entre páginas', () => {
    // Quantidades que levam a tabela até o fim da folha em pontos diferentes.
    for (const n of [16, 17, 18, 19, 20]) {
      const text = pdfText(buildSheetPdf(header, Array.from({ length: n }, (_, i) => ocorrencia(i))));
      const paginas = text.split('/Type /Page\n').slice(1);
      const titulo = paginas.findIndex((p) => p.includes('TEC.LIDER RESPONSAVEL'));
      const total = paginas.findIndex((p) => p.includes('PRODUÇÃO TOTAL:'));
      expect(titulo, `${n} OSs`).toBe(total);
    }
  });

  it('mais de 15 OSs: a tabela continua na página seguinte com o cabeçalho das colunas', () => {
    const doc = buildSheetPdf(header, Array.from({ length: 23 }, (_, i) => ocorrencia(i)));
    const text = pdfText(doc);
    expect(doc.getNumberOfPages()).toBe(2);
    expect(text).toContain('(23) Tj');
    expect(text.split('INFO ADICIONAL').length - 1).toBe(2);
  });
});
