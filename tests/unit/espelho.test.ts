import { describe, expect, it } from 'vitest';
import { questionsFor } from '../../src/domain/catalog';
import { espelhoRows } from '../../src/domain/espelho';
import { finishedOS } from './fixtures';

describe('linhas do Espelho de Campo', () => {
  it('toda pergunta sem coluna própria tem rótulo curto para INFO ADICIONAL', () => {
    for (const type of ['COMERCIAL', 'OCORRENCIA'] as const) {
      const semRotulo = questionsFor(type).filter((q) => !q.espelho && !q.prefillOS && !q.short);
      expect(semRotulo.map((q) => q.id)).toEqual([]);
    }
  });

  it('colunas próprias recebem tipo, medidores e leituras; o resto vai para INFO ADICIONAL (sem o "Não" de "se sim, qual?")', () => {
    const os = finishedOS('7788', 'OCORRENCIA', '508', {
      o1: { kind: 'text', value: 'Troca de medidor' },
      o3: { kind: 'choice', choice: 'Sim' },
      o6: { kind: 'choice', choice: 'Não' },
      o7: { kind: 'text', value: '45210' },
      o11: { kind: 'choice', choice: 'Sim', detail: 'Cachorro solto' },
      o12: { kind: 'choice', choice: 'Sim', detail: 'M-100' },
      o13: { kind: 'choice', choice: 'Sim', detail: 'M-050' },
      o14: { kind: 'text', value: '0' },
      o15: { kind: 'text', value: '15432' },
      o18: { kind: 'choice', choice: 'Não' },
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
        info: 'Callback: Sim; DITAIS: Não; KM ini: 45210; Dificuldade: Cachorro solto',
      },
    ]);
  });

  it('comercial: respostas de SIM/NÃO em INFO ADICIONAL; OS sem número vira S/N', () => {
    const os = finishedOS('', 'COMERCIAL', '709', { c2: { kind: 'choice', choice: 'Sim' }, c3: { kind: 'choice', choice: 'Não' } });
    expect(espelhoRows([os])[0]).toMatchObject({ os: 'S/N', tipo: '709', medidorInstalado: '', info: 'Cliente presente: Sim; Lançou ramal: Não' });
  });

  it('perguntas puladas e o número da OS não entram em INFO ADICIONAL', () => {
    const os = finishedOS('123', 'OCORRENCIA', '503', { o12: { kind: 'choice', choice: 'Não' } });
    const [row] = espelhoRows([os]);
    expect(row?.medidorInstalado).toBe('');
    expect(row?.info).toBe('');
  });
});
