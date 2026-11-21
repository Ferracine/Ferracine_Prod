import { describe, expect, it } from 'vitest';
import type { OrdemServico, ShiftHeader, Tecnico } from '../../src/domain/types';
import { buildSheetPdf } from '../../src/pdf';
import { baseHeader, finishedOS } from './fixtures';

const tecnicos: Tecnico[] = [
  { id: 't1', nome: 'TEC. FULANO DE TAL', telefone: '69 90000-0001' },
  { id: 't2', nome: 'TEC. BELTRANO SOUZA', telefone: '69 90000-0002' },
];

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
  lider: 't2',
};

function comercial(n: number): OrdemServico {
  return finishedOS(String(900000 + n), 'COMERCIAL', '709', {
    tipo: { kind: 'text', value: 'Ligação nova' },
    kmIni: { kind: 'text', value: '45210' },
    horaIni: { kind: 'text', value: '08:15' },
    clientePresente: { kind: 'choice', choice: 'Sim' },
    medidorInst: { kind: 'choice', choice: 'Sim', detail: `MED-${n}` },
    leituraInst: { kind: 'text', value: '1543210' },
    kmFin: { kind: 'text', value: '45235' },
    horaFin: { kind: 'text', value: '09:40' },
  }, `id-${n}`);
}

/** Ocorrência com todas as perguntas respondidas (o pior caso para o espaço da INFO ADICIONAL). */
function ocorrenciaCompleta(n: number): OrdemServico {
  return finishedOS(`16438545${n}`, 'OCORRENCIA', '508', {
    callback: { kind: 'choice', choice: 'Sim' },
    horaIni: { kind: 'text', value: '08:15' },
    kmIni: { kind: 'text', value: '45210' },
    tipo: { kind: 'text', value: 'Falta de energia' },
    defeito: { kind: 'text', value: 'Fusível queimado' },
    dispositivo: { kind: 'text', value: 'Chave fusível' },
    ditais: { kind: 'choice', choice: 'Sim' },
    kmFin: { kind: 'text', value: '45235' },
    alteracaoUC: { kind: 'text', value: 'Troca do disjuntor do padrão' },
    horaFin: { kind: 'text', value: '09:40' },
    dificuldade: { kind: 'choice', choice: 'Sim', detail: 'Acesso difícil ao poste' },
  }, `id-${n}`);
}

/** jsPDF grava o texto sem compressão e com acentos em latin-1: dá para procurar strings direto no arquivo. */
function pdfText(doc: ReturnType<typeof buildSheetPdf>): string {
  return doc.output();
}

/** Emenda linhas de texto consecutivas: títulos e textos longos que quebram linha (ex.: "TIPO DE" / "SERVIÇO"). */
function flat(text: string): string {
  return text.replace(/\) Tj\n[^(]*\(/g, ' ');
}

describe('PDF do Espelho de Campo', () => {
  it('traz identificação, as colunas do espelho, INFO ADICIONAL e técnicos cadastrados numa folha A4 paisagem', () => {
    const doc = buildSheetPdf(header, [comercial(1), ocorrenciaCompleta(2)], tecnicos);
    const text = pdfText(doc);
    for (const s of [
      'DEPARTAMENTO DE OPERAÇÃO',
      'ESPELHO DE CAMPO',
      '(Carlos Pereira)',
      '(PVH-01)',
      '(3226)',
      '(20/11/2026)',
      '(07:00 às 17:00)',
      '(ITEM)',
      '(709)',
      '(45210)',
      '(08:15)',
      '(09:40)',
      '(MED-1)',
      '(1543210)',
      '(SIM)',
      'TEC.LIDER RESPONSAVEL PELA EQUIPE',
      'PRODUÇÃO TOTAL:',
      '(TEC. BELTRANO SOUZA)',
      '(69 90000-0002)',
      '(TEC. FULANO DE TAL)',
      '/Subtype /Image',
    ]) {
      expect(text).toContain(s);
    }
    const emendado = flat(text);
    for (const s of ['TIPO DE SERVIÇO', 'KM INICIAL', 'HORÁRIO INICIAL', 'HORÁRIO FINAL', 'KM FINAL', 'CLIENTE PRESENTE', 'INFO ADICIONAL', 'Tipo: Ligação nova', 'Tipo: Falta de energia', 'Dificuldade: Acesso difícil ao poste']) {
      expect(emendado).toContain(s);
    }
    // TIPO DE SERVIÇO traz só o código: a descrição está em INFO ADICIONAL.
    expect(text).not.toContain('709 - Ligação nova');
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(297, 0);
  });

  it('folha em branco: 15 linhas numeradas, produção zero e nenhum técnico pré-cadastrado', () => {
    const text = pdfText(buildSheetPdf({ ...header, lider: '' }, [], []));
    expect(text).toContain('(15) Tj');
    expect(text).not.toContain('(16) Tj');
    expect(text).toMatch(/\(0\) Tj/);
    expect(text).not.toContain('TEC. BELTRANO');
  });

  it('15 ocorrências com todas as perguntas respondidas cabem numa folha', () => {
    const doc = buildSheetPdf(header, Array.from({ length: 15 }, (_, i) => ocorrenciaCompleta(i)), tecnicos);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('nada é cortado: textos longos quebram linha', () => {
    const longo = 'Religação de unidade consumidora com troca de ramal e disjuntor danificado pela chuva';
    const os = finishedOS('1', 'OCORRENCIA', '508', { defeito: { kind: 'text', value: `${longo} ${longo}` } });
    const text = flat(pdfText(buildSheetPdf(header, [os], tecnicos)));
    expect(text).not.toContain('...');
    expect(text).toContain(`Defeito: ${longo} ${longo}`);
  });

  it('mais de 3 técnicos: o rodapé ganha linhas e todos aparecem', () => {
    const muitos = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, nome: `TEC. NUMERO ${i}`, telefone: `69 9000-000${i}` }));
    const text = pdfText(buildSheetPdf(header, [], muitos));
    for (const t of muitos) expect(text).toContain(`(${t.nome})`);
  });

  it('mais de 15 OSs: logo e identificação só na 1ª folha; data, equipe e folha embaixo de todas; produção na última', () => {
    const doc = buildSheetPdf(header, Array.from({ length: 22 }, (_, i) => (i % 2 ? comercial(i) : ocorrenciaCompleta(i))), tecnicos);
    expect(doc.getNumberOfPages()).toBe(2);
    const [f1 = '', f2 = ''] = doc.output().split('/Type /Page\n').slice(1);
    for (const s of ['ESPELHO DE CAMPO', '(Carlos Pereira)', '/I0 Do']) {
      expect(f1).toContain(s);
      expect(f2).not.toContain(s);
    }
    for (const [pagina, n] of [[f1, 1], [f2, 2]] as const) {
      expect(pagina).toContain('(DATA: 20/11/2026   |   EQUIPE: PVH-01)');
      expect(pagina).toContain(`(FOLHA ${n}/2)`);
      expect(flat(pagina)).toContain('TIPO DE SERVIÇO'); // títulos das colunas em toda folha
    }
    expect(f1).toContain('(15) Tj');
    expect(f1).not.toContain('(16) Tj');
    expect(f1).not.toContain('PRODUÇÃO TOTAL:');
    // Segunda folha: OSs 16 a 22 e linhas em branco numeradas até 30, como no papel.
    expect(f2).toContain('(16) Tj');
    expect(f2).toContain('(30) Tj');
    expect(f2).toContain('PRODUÇÃO TOTAL:');
    expect(f2).toContain('(22) Tj');
  });

  it('folha única também leva data, equipe e FOLHA 1/1 embaixo', () => {
    const text = pdfText(buildSheetPdf(header, [comercial(1)], tecnicos));
    expect(text).toContain('(DATA: 20/11/2026   |   EQUIPE: PVH-01)');
    expect(text).toContain('(FOLHA 1/1)');
    expect(pdfText(buildSheetPdf({ ...header, equipe: '' }, [], []))).toContain('(DATA: 20/11/2026)');
  });

  it('mais de 15 OSs: o rodapé nunca se divide', () => {
    for (const n of [16, 18, 20, 23]) {
      const doc = buildSheetPdf(header, Array.from({ length: n }, (_, i) => comercial(i)), tecnicos);
      const text = pdfText(doc);
      expect(text).toContain(`(${n}) Tj`);
      const paginas = text.split('/Type /Page\n').slice(1);
      const titulo = paginas.findIndex((p) => p.includes('TEC.LIDER RESPONSAVEL'));
      const total = paginas.findIndex((p) => p.includes('PRODUÇÃO TOTAL:'));
      expect(titulo, `${n} OSs`).toBe(total);
    }
  });
});
