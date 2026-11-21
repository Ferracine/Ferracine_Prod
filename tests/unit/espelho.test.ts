import { describe, expect, it } from 'vitest';
import { questionsFor } from '../../src/domain/catalog';
import { espelhoRows } from '../../src/domain/espelho';
import { finishedOS } from './fixtures';

describe('linhas do Espelho de Campo', () => {
  it('toda pergunta sem coluna própria tem rótulo curto para INFO ADICIONAL', () => {
    for (const type of ['COMERCIAL', 'OCORRENCIA'] as const) {
      const semRotulo = questionsFor(type).filter((q) => !q.espelho && !q.prefillOS && !q.semInfo && !q.short);
      expect(semRotulo.map((q) => q.id)).toEqual([]);
    }
  });

  it('comercial: código sozinho, KM/horários/medidores/leituras/cliente nas colunas, o resto em INFO ADICIONAL', () => {
    const os = finishedOS('7788', 'COMERCIAL', '709', {
      tipo: { kind: 'text', value: 'Ligação nova' },
      kmIni: { kind: 'text', value: '45210' },
      horaIni: { kind: 'text', value: '08:15' },
      clientePresente: { kind: 'choice', choice: 'Sim' },
      ramal: { kind: 'choice', choice: 'Não' },
      medidorInst: { kind: 'choice', choice: 'Sim' },
      medidorInstNum: { kind: 'text', value: 'M-100' },
      leituraInst: { kind: 'text', value: '0' },
      medidorRet: { kind: 'choice', choice: 'Sim' },
      medidorRetNum: { kind: 'text', value: 'M-050' },
      leituraRet: { kind: 'text', value: '15432' },
      kmFin: { kind: 'text', value: '45235' },
      horaFin: { kind: 'text', value: '09:40' },
      dificuldade: { kind: 'choice', choice: 'Sim', detail: 'Cachorro solto' },
    });
    expect(espelhoRows([os])).toEqual([
      {
        item: 1,
        os: '7788',
        codigo: '709',
        kmIni: '45210',
        horaIni: '08:15',
        horaFin: '09:40',
        kmFin: '45235',
        medidorInstalado: 'M-100',
        leituraInstalado: '0',
        medidorRetirado: 'M-050',
        leituraRetirado: '15432',
        clientePresente: 'Sim',
        info: 'Tipo: Ligação nova; Lançou ramal: Não; Dificuldade: Cachorro solto',
      },
    ]);
  });

  it('ocorrência: tipo, callback, defeito, dispositivo, DITAIS, alteração na UC e dificuldade vão para INFO ADICIONAL', () => {
    const os = finishedOS('', 'OCORRENCIA', '508', {
      callback: { kind: 'choice', choice: 'Sim' },
      horaIni: { kind: 'text', value: '10:00' },
      tipo: { kind: 'text', value: 'Falta de energia' },
      defeito: { kind: 'text', value: 'Fusível' },
      dispositivo: { kind: 'text', value: 'Chave fusível' },
      ditais: { kind: 'choice', choice: 'Não' },
      alteracaoUC: { kind: 'text', value: 'Troca de disjuntor' },
      dificuldade: { kind: 'choice', choice: 'Não' },
    });
    const [row] = espelhoRows([os]);
    expect(row).toMatchObject({ os: 'S/N', codigo: '508', horaIni: '10:00', kmIni: '', clientePresente: '' });
    // O "Não" de uma pergunta "se sim, qual?" não acrescenta nada à folha.
    expect(row?.info).toBe('Callback: Sim; Tipo: Falta de energia; Defeito: Fusível; Disp.: Chave fusível; DITAIS: Não; Alteração UC: Troca de disjuntor');
  });

  it('respostas antigas preservadas na migração vão para INFO ADICIONAL', () => {
    const os = { ...finishedOS('5', 'OCORRENCIA', '508', { callback: { kind: 'choice', choice: 'Sim' } }), infoLegada: 'Medidor instalado: M-1' };
    expect(espelhoRows([os])[0]?.info).toBe('Callback: Sim; Medidor instalado: M-1');
  });

  it('perguntas puladas e o número da OS não entram em INFO ADICIONAL', () => {
    const [row] = espelhoRows([finishedOS('123', 'OCORRENCIA', '503')]);
    expect(row?.info).toBe('');
    expect(row?.os).toBe('123');
  });
});
