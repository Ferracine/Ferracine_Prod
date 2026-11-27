import { describe, expect, it } from 'vitest';
import { questionsFor } from '../../src/domain/catalog';
import { espelhoRows } from '../../src/domain/espelho';
import { DITAIS_NAO, finishedOS } from './fixtures';

describe('linhas do Espelho de Campo', () => {
  it('toda pergunta sem coluna própria tem rótulo curto para INFORMAÇÃO ADICIONAL', () => {
    for (const type of ['COMERCIAL', 'OCORRENCIA'] as const) {
      const semRotulo = questionsFor(type).filter((q) => !q.espelho && !q.semInfo && !q.semRotulo && !q.short);
      expect(semRotulo.map((q) => q.id)).toEqual([]);
    }
  });

  it('comercial: código sozinho, KM/horários/medidores/leituras/cliente nas colunas, o resto em INFORMAÇÃO ADICIONAL', () => {
    const os = finishedOS('7788', 'COMERCIAL', '709', {
      tipo: { kind: 'text', value: 'Ligação nova' },
      kmIni: { kind: 'text', value: '45210' },
      horaIni: { kind: 'text', value: '08:15' },
      clientePresente: { kind: 'choice', choice: 'Sim' },
      ramal: { kind: 'choice', choice: 'Não' },
      // Troca: o medidor da UC (M-050) sai em MEDIDOR RETIRADO; o novo (M-100), em MEDIDOR INSTALADO.
      medidorInstNum: { kind: 'text', value: 'M-050' },
      leituraInst: { kind: 'text', value: '15432' },
      novoMedidor: { kind: 'choice', choice: 'Sim' },
      novoMedidorNum: { kind: 'text', value: 'M-100' },
      novoLeitura: { kind: 'text', value: '0' },
      kmFin: { kind: 'text', value: '45235' },
      horaFin: { kind: 'text', value: '09:40' },
      infoAdicional: { kind: 'text', value: 'Cachorro solto' },
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
        // Informações adicionais: o relato vai sem rótulo (a coluna já é INFORMAÇÃO ADICIONAL).
        info: 'Tipo: Ligação nova; Lançou ramal: Não; Cachorro solto',
      },
    ]);
  });

  it('comercial sem troca: o medidor da UC vai para MEDIDOR INSTALADO', () => {
    const os = finishedOS('1', 'COMERCIAL', '709', {
      medidorInstNum: { kind: 'text', value: 'UC-1' },
      leituraInst: { kind: 'text', value: '42' },
      novoMedidor: { kind: 'choice', choice: 'Não' },
    });
    expect(espelhoRows([os])[0]).toMatchObject({ medidorInstalado: 'UC-1', leituraInstalado: '42', medidorRetirado: '', leituraRetirado: '' });
    expect(espelhoRows([os])[0]?.info).not.toContain('novo medidor');
  });

  it('ocorrência salva antes da 1.4.18: callback, defeito, dispositivo e alteração na UC continuam em INFORMAÇÃO ADICIONAL', () => {
    const os = finishedOS('', 'OCORRENCIA', '508', {
      callback: { kind: 'choice', choice: 'Sim' },
      horaIni: { kind: 'text', value: '10:00' },
      tipo: { kind: 'text', value: 'Falta de energia' },
      defeito: { kind: 'text', value: 'Fusível' },
      dispositivo: { kind: 'text', value: 'Chave fusível' },
      ...DITAIS_NAO,
      alteracaoUC: { kind: 'text', value: 'Troca de disjuntor' },
      infoAdicional: { kind: 'text', value: 'Poste em área alagada' },
    });
    const [row] = espelhoRows([os]);
    expect(row).toMatchObject({ os: 'S/N', codigo: '508', horaIni: '10:00', kmIni: '', clientePresente: '' });
    expect(row?.info).toBe('Tipo: Falta de energia; DITAIS: Não; Callback: Sim; Defeito: Fusível; Disp.: Chave fusível; Alteração UC: Troca de disjuntor; Poste em área alagada');
  });

  it('perguntas puladas não entram em INFORMAÇÃO ADICIONAL', () => {
    const [row] = espelhoRows([finishedOS('123', 'OCORRENCIA', '503')]);
    expect(row?.info).toBe('');
    expect(row?.os).toBe('123');
  });
});
