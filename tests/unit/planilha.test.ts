import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { Tecnico } from '../../src/domain/types';
import { buildSheetXlsx, planilhaLinhas } from '../../src/planilha';
import { baseHeader, finishedOS } from './fixtures';

const header = { ...baseHeader, nome1: 'ANA LIMA', mat1: '111', nome2: 'BIA SOUZA', mat2: '222', equipe: 'PVH-01', lider: 't1' };
const tecnicos: Tecnico[] = [{ id: 't1', nome: 'TEC. FULANO', telefone: '69 90000-0001' }];
const ordens = [
  finishedOS('00123', 'COMERCIAL', '709', {
    tipo: { kind: 'text', value: 'RELIGA & <TESTE>' },
    kmIni: { kind: 'text', value: '45210' },
    medidorInstNum: { kind: 'text', value: '00N62' },
    leituraInst: { kind: 'text', value: '0012' },
  }),
  finishedOS('', 'OCORRENCIA', '508', { ditais: { kind: 'choice', choice: 'Sim' } }),
];

describe('planilha (.xlsx)', () => {
  it('é um .xlsx válido: partes do Office Open XML e a aba "Espelho de Campo"', () => {
    const zip = unzipSync(buildSheetXlsx(header, ordens, tecnicos));
    for (const parte of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) {
      expect(zip[parte], parte).toBeDefined();
    }
    expect(strFromU8(zip['xl/workbook.xml']!)).toContain('name="Espelho de Campo"');
  });

  it('identificação da equipe, colunas do espelho e uma linha por OS (texto escapado; números como texto)', () => {
    const xml = strFromU8(unzipSync(buildSheetXlsx(header, ordens, tecnicos))['xl/worksheets/sheet1.xml']!);
    for (const s of ['ANA LIMA', 'BIA SOUZA', 'PVH-01', '20/11/2026', '07:00 às 17:00', 'TEC. FULANO - 69 90000-0001', 'MEDIDOR INSTALADO', 'INFO ADICIONAL', 'COMERCIAL', 'OCORRÊNCIA', 'S/N']) {
      expect(xml).toContain(s);
    }
    // Zeros à esquerda preservados (texto, não número) e caracteres especiais escapados.
    expect(xml).toContain('<t xml:space="preserve">00123</t>');
    expect(xml).toContain('<t xml:space="preserve">00N62</t>');
    expect(xml).toContain('Tipo: RELIGA &amp; &lt;TESTE&gt;');
    expect(xml).not.toContain('<TESTE>');
    // KM vai como número (o Excel soma); leitura com zero à esquerda continua texto.
    expect(xml).toMatch(/<c r="E\d+"><v>45210<\/v><\/c>/);
    expect(xml).toContain('<t xml:space="preserve">0012</t>');
  });

  it('linhas: identificação + cabeçalho da tabela + uma por OS; produção total = quantidade de OSs', () => {
    const linhas = planilhaLinhas(header, ordens, tecnicos);
    const cabecalho = linhas.findIndex((l) => l[0] && typeof l[0] === 'object' && l[0].v === 'ITEM');
    expect(linhas.length - cabecalho - 1).toBe(2);
    expect(linhas.find((l) => typeof l[0] === 'object' && l[0].v === 'Produção total')?.[1]).toBe(2);
    // Solo: sem a linha do Eletricista 2.
    const solo = planilhaLinhas({ ...header, nome2: '', mat2: '' }, ordens, tecnicos);
    expect(solo.some((l) => typeof l[0] === 'object' && l[0].v === 'Eletricista 2')).toBe(false);
  });
});
