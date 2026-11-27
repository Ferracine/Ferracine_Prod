import { describe, expect, it } from 'vitest';
import { questionsFor } from '../../src/domain/catalog';
import type { Answer, OSDraft } from '../../src/domain/types';
import * as ordem from '../../src/domain/ordem';
import { espelhoRows } from '../../src/domain/espelho';
import { DITAIS_NAO, finishedOS } from './fixtures';

describe('catálogo', () => {
  it('ocorrência tem as mesmas perguntas da comercial, na mesma ordem', () => {
    expect(questionsFor('OCORRENCIA')).toEqual(questionsFor('COMERCIAL'));
  });

  it('comercial segue a ordem definida pelo dono do app', () => {
    expect(questionsFor('COMERCIAL').map((q) => q.text)).toEqual([
      'Qual tipo de serviço?',
      'Deseja informar o KM inicial?',
      'Deseja informar a hora inicial?',
      'Cliente presente?',
      'Foi necessário lançar ramal?',
      'Digite o número do medidor instalado',
      'Qual a leitura do medidor instalado?',
      'Foi instalado novo medidor?',
      'Digite o número do medidor novo',
      'Qual a leitura do medidor novo?',
      'Houve necessidade de realizar os DITAIS?',
      'Deseja informar o KM final?',
      'Deseja informar o horário final?',
      'Informações adicionais',
    ]);
  });

  it('ids únicos e, nos dois tipos, só a pergunta dos DITAIS é obrigatória', () => {
    for (const type of ['COMERCIAL', 'OCORRENCIA'] as const) {
      const ids = questionsFor(type).map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      const required = questionsFor(type).filter((q) => q.required);
      expect(required.map((q) => q.id)).toEqual(['ditais']);
      expect(required[0]?.isDitais).toBe(true);
    }
  });
});

describe('OS nova (tela da OS)', () => {
  const agora = new Date('2026-11-20T10:00:00Z');

  it('OS nova começa em branco: sem número (S/N), sem código e sem respostas', () => {
    expect(ordem.startDraft('OCORRENCIA')).toEqual({ osNumber: '', serviceType: 'OCORRENCIA', serviceCode: '', answers: {} });
  });

  it('salva com número, código e respostas normalizadas; número vazio vira S/N', () => {
    const d = ordem.startDraft('COMERCIAL');
    const r = ordem.createOS({ ...d, osNumber: ' 555 ', serviceCode: ' 709 ', answers: { tipo: { kind: 'text', value: '  Ligação nova  ' }, ...DITAIS_NAO } }, 'id-1', agora);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.os).toMatchObject({ id: 'id-1', osNumber: '555', serviceType: 'COMERCIAL', serviceCode: '709', registradaEm: '2026-11-20T10:00:00.000Z' });
    expect(Object.keys(r.os.answers)).toHaveLength(14);
    expect(r.os.answers.tipo).toEqual({ kind: 'text', value: 'Ligação nova' });
    expect(r.os.answers.kmIni).toEqual({ kind: 'skipped' });
    const sn = ordem.createOS({ ...d, serviceCode: '709', answers: DITAIS_NAO }, 'id-2', agora);
    expect(sn.ok && sn.os.osNumber).toBe('');
  });

  it('ocorrência: o número fica só no campo do topo (sem cópia escondida nas respostas)', () => {
    const d = { ...ordem.startDraft('OCORRENCIA'), serviceCode: '508' };
    const r = ordem.createOS({ ...d, osNumber: '4455', answers: DITAIS_NAO }, 'x', agora);
    expect(r.ok && r.os.osNumber).toBe('4455');
    expect(r.ok && 'os' in r.os.answers).toBe(false);
  });

  it('mesmas regras da edição: DITAIS obrigatória e código', () => {
    const d = { ...ordem.startDraft('OCORRENCIA'), serviceCode: '508' };
    const semDitais = ordem.createOS(d, 'x', agora);
    expect(semDitais.ok).toBe(false);
    if (!semDitais.ok) expect(semDitais.field).toBe('ditais');
    expect(ordem.createOS({ ...d, serviceCode: ' ', answers: DITAIS_NAO }, 'x', agora)).toMatchObject({ ok: false, field: ordem.CODE_FIELD });
  });

  it('qualquer código vale nos dois tipos (sem trava de código): o código fica como foi digitado, só aparado', () => {
    const ocorrencia = ordem.createOS({ ...ordem.startDraft('OCORRENCIA'), serviceCode: ' 709 ', answers: DITAIS_NAO }, 'x', agora);
    expect(ocorrencia.ok && ocorrencia.os.serviceCode).toBe('709');
    const comercial = ordem.createOS({ ...ordem.startDraft('COMERCIAL'), serviceCode: '0508', answers: DITAIS_NAO }, 'x', agora);
    expect(comercial.ok && comercial.os.serviceCode).toBe('0508');
  });

  it('OS comercial antiga (sem a resposta dos DITAIS): avisada, sem DITAIS na folha, e o lápis pede a resposta', () => {
    const antiga = { ...finishedOS('1', 'COMERCIAL', '28', { ...DITAIS_NAO }), answers: { tipo: { kind: 'text', value: 'RELIGA' } } as Record<string, Answer> };
    expect(ordem.faltaObrigatoria(antiga)).toBe(true);
    expect(ordem.faltaObrigatoria(finishedOS('2', 'COMERCIAL', '28', { ...DITAIS_NAO }))).toBe(false);
    expect(ordem.answerRows(antiga).find((r) => r.isDitais)).toMatchObject({ skipped: true, display: 'Falta responder (obrigatória): use Editar' });
    expect(espelhoRows([antiga])[0]?.info).toBe('Tipo: RELIGA');
    expect(ordem.applyEdit(antiga, antiga)).toMatchObject({ ok: false, field: 'ditais' });
  });

  it('código do serviço: espaços saem, zero à esquerda fica como foi digitado', () => {
    const r = ordem.createOS({ ...ordem.startDraft('COMERCIAL'), serviceCode: ' 7 09 ', answers: DITAIS_NAO }, 'x', agora);
    expect(r.ok && r.os.serviceCode).toBe('709');
  });

  it('pendências do encerramento: OSs sem número e sem DITAIS', () => {
    const ok = finishedOS('1', 'COMERCIAL', '28', { ...DITAIS_NAO });
    const sn = finishedOS('', 'OCORRENCIA', '508', { ...DITAIS_NAO });
    const semDitais = { ...ok, answers: {} };
    expect(ordem.pendencias([ok])).toEqual({ semNumero: 0, semDitais: 0 });
    expect(ordem.pendencias([ok, sn, semDitais])).toEqual({ semNumero: 1, semDitais: 1 });
  });

  it('comercial também exige a pergunta dos DITAIS', () => {
    const semDitais = ordem.createOS({ ...ordem.startDraft('COMERCIAL'), serviceCode: '28' }, 'x', agora);
    expect(semDitais).toMatchObject({ ok: false, field: 'ditais' });
  });

  it('medidores da comercial: o da UC sempre vale; o novo só com "Foi instalado novo medidor?" = SIM', () => {
    const base = { ...ordem.startDraft('COMERCIAL'), serviceCode: '709' };
    const num: Record<string, Answer> = { medidorInstNum: { kind: 'text', value: 'N1' }, leituraInst: { kind: 'text', value: '10' }, novoMedidorNum: { kind: 'text', value: 'NV1' }, novoLeitura: { kind: 'text', value: '0' } };
    const salvar = (novo?: 'Sim' | 'Não') => {
      const answers: Record<string, Answer> = { ...num, ...DITAIS_NAO };
      if (novo) answers.novoMedidor = { kind: 'choice', choice: novo };
      const r = ordem.createOS({ ...base, answers }, 'x', agora);
      if (!r.ok) throw new Error(r.error);
      return r.os.answers;
    };
    expect(salvar('Sim')).toMatchObject(num);
    // NÃO (ou sem resposta): o que foi digitado no novo (escondido) não vale; o da UC continua.
    for (const r of [salvar('Não'), salvar()]) {
      expect(r).toMatchObject({ medidorInstNum: num.medidorInstNum, leituraInst: num.leituraInst, novoMedidorNum: { kind: 'skipped' }, novoLeitura: { kind: 'skipped' } });
    }
  });

  it('"X de Y respondidas" conta só as perguntas que aparecem', () => {
    const semNovo = finishedOS('1', 'COMERCIAL', '709', { novoMedidor: { kind: 'choice', choice: 'Não' } });
    expect(ordem.answerRows(semNovo)).toHaveLength(14 - 2);
    const comNovo = finishedOS('1', 'COMERCIAL', '709', { novoMedidor: { kind: 'choice', choice: 'Sim' } });
    expect(ordem.answerRows(comNovo)).toHaveLength(14);
  });

  it('finalize transforma respostas incompletas em "pulada"', () => {
    const d: OSDraft = {
      osNumber: '1',
      serviceType: 'OCORRENCIA',
      serviceCode: '508',
      answers: { tipo: { kind: 'text', value: '  ' }, infoAdicional: { kind: 'text', value: ' \n ' }, ramal: { kind: 'text', value: 'x' } },
    };
    const os = ordem.finalize(d, 'x', new Date());
    expect(os.answers.tipo).toEqual({ kind: 'skipped' });
    expect(os.answers.infoAdicional).toEqual({ kind: 'skipped' });
    const relato = ordem.finalize({ ...d, answers: { infoAdicional: { kind: 'text', value: ' POSTE\n\n  CAÍDO \n' } } }, 'x', new Date());
    expect(relato.answers.infoAdicional).toEqual({ kind: 'text', value: 'POSTE CAÍDO' });
    expect(os.answers.ramal).toEqual({ kind: 'skipped' });
  });

  it('isUnchanged: OS recém-aberta sai sem confirmação; número, texto ou SIM/NÃO contam como preenchido', () => {
    const d = ordem.startDraft('OCORRENCIA');
    expect(ordem.isUnchanged(d)).toBe(true);
    expect(ordem.isUnchanged({ ...d, serviceCode: '508' })).toBe(false);
    expect(ordem.isUnchanged({ ...d, answers: { tipo: { kind: 'text', value: '' } } })).toBe(true); // texto apagado
    expect(ordem.isUnchanged({ ...d, osNumber: '12' })).toBe(false);
    expect(ordem.isUnchanged({ ...d, answers: { ramal: { kind: 'choice', choice: 'Sim' } } })).toBe(false);
    expect(ordem.isUnchanged({ ...d, answers: { tipo: { kind: 'text', value: 'Falta' } } })).toBe(false);
    // Número do medidor novo digitado e depois escondido (SIM desmarcado): não conta.
    const comercial = ordem.startDraft('COMERCIAL');
    expect(ordem.isUnchanged({ ...comercial, answers: { novoMedidorNum: { kind: 'text', value: 'N1' } } })).toBe(true);
  });

  it('answerRows descreve cada pergunta para o app', () => {
    const os = finishedOS('7', 'OCORRENCIA', '503', { ditais: { kind: 'choice', choice: 'Sim' }, infoAdicional: { kind: 'text', value: 'Chuva' } });
    const rows = ordem.answerRows(os);
    // O número da OS fica no topo da tela (S/N não conta como "não respondida"); o medidor novo está escondido.
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ question: 'Qual tipo de serviço?', display: 'Não informado', skipped: true, isDitais: false });
    expect(rows[8]).toMatchObject({ display: 'Sim', isDitais: true, skipped: false });
    expect(rows[11]).toMatchObject({ question: 'Informações adicionais', display: 'Chuva' });
  });

});

describe('edição completa de OS (lápis)', () => {
  const base = () => finishedOS('100', 'OCORRENCIA', '508', { ...DITAIS_NAO, tipo: { kind: 'text', value: 'Falta' } }, 'id-9');

  it('altera número, código e respostas mantendo id e horário de registro', () => {
    const os = base();
    const r = ordem.applyEdit(os, { osNumber: ' 101 ', serviceCode: ' 509 ', answers: { ...os.answers, tipo: { kind: 'text', value: 'Religação' }, kmIni: { kind: 'text', value: '45210' } } });
    if (!r.ok) throw new Error(r.error);
    expect(r.os).toMatchObject({ id: 'id-9', osNumber: '101', serviceCode: '509', registradaEm: os.registradaEm });
    expect(r.os.answers.tipo).toEqual({ kind: 'text', value: 'Religação' });
    expect(r.os.answers.kmIni).toEqual({ kind: 'text', value: '45210' });
  });

  it('número vazio vira S/N', () => {
    const os = base();
    const r = ordem.applyEdit(os, { osNumber: '  ', serviceCode: '508', answers: os.answers });
    if (!r.ok) throw new Error(r.error);
    expect(r.os.osNumber).toBe('');
  });

  it('aplica as regras: código obrigatório e DITAIS obrigatória', () => {
    const os = base();
    expect(ordem.applyEdit(os, { osNumber: '1', serviceCode: ' ', answers: os.answers }).ok).toBe(false);
    const semDitais = ordem.applyEdit(os, { osNumber: '1', serviceCode: '508', answers: { ...os.answers, ditais: { kind: 'skipped' } } });
    expect(semDitais).toMatchObject({ ok: false, field: 'ditais' });
  });
});
