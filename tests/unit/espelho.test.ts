import { describe, expect, it } from 'vitest';
import { espelhoRows } from '../../src/domain/espelho';
import { finishedOS } from './fixtures';

describe('linhas do Espelho de Campo', () => {
  it('leva tipo, medidores, leituras e desvios da ocorrência para as colunas do espelho', () => {
    const os = finishedOS('7788', 'OCORRENCIA', '508', {
      o1: { kind: 'text', value: 'Troca de medidor' },
      o6: { kind: 'choice', choice: 'Não' },
      o11: { kind: 'choice', choice: 'Sim', detail: 'Cachorro solto' },
      o12: { kind: 'choice', choice: 'Sim', detail: 'M-100' },
      o13: { kind: 'choice', choice: 'Sim', detail: 'M-050' },
      o14: { kind: 'text', value: '0' },
      o15: { kind: 'text', value: '15432' },
      o18: { kind: 'choice', choice: 'Sim', detail: 'Poste sem acesso' },
    });
    expect(espelhoRows([os])).toEqual([
      {
        item: 1,
        os: '7788',
        tipo: '508 - Troca de medidor',
        medidorInstalado: 'M-100',
        leituraInstalado: '0',
        medidorRetirado: 'M-050',
        leituraRetirado: '15432',
        desvios: 'Cachorro solto; Poste sem acesso',
      },
    ]);
  });

  it('OS comercial sem número: S/N, só o código no tipo e colunas de medidor vazias', () => {
    const os = finishedOS('', 'COMERCIAL', '709');
    expect(espelhoRows([os, os]).map((r) => [r.item, r.os, r.tipo, r.medidorInstalado, r.desvios])).toEqual([
      [1, 'S/N', '709', '', ''],
      [2, 'S/N', '709', '', ''],
    ]);
  });

  it('medidor marcado como NÃO fica em branco', () => {
    const os = finishedOS('1', 'OCORRENCIA', '503', { o12: { kind: 'choice', choice: 'Não' } });
    expect(espelhoRows([os])[0]?.medidorInstalado).toBe('');
  });
});
