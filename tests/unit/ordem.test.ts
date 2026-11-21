import { describe, expect, it } from 'vitest';
import { questionsFor } from '../../src/domain/catalog';
import type { OSDraft } from '../../src/domain/types';
import * as ordem from '../../src/domain/ordem';
import { finishedOS } from './fixtures';

describe('catálogo', () => {
  it('ocorrência segue a ordem definida pelo dono do app', () => {
    expect(questionsFor('OCORRENCIA').map((q) => q.text)).toEqual([
      'Tentou callback?',
      'Qual número da Ordem de serviço?',
      'Deseja informar a hora inicial?',
      'Deseja informar o KM inicial?',
      'Qual tipo de serviço?',
      'Qual foi o defeito?',
      'Qual dispositivo manobrado?',
      'Houve necessidade de realizar os DITAIS?',
      'Deseja informar o KM final?',
      'Deseja informar alguma alteração feita na UC do cliente?',
      'Número do medidor instalado',
      'Qual leitura do medidor instalado?',
      'Deseja informar a hora final?',
      'Houve alguma dificuldade, se sim qual?',
    ]);
  });

  it('comercial segue a ordem definida pelo dono do app', () => {
    expect(questionsFor('COMERCIAL').map((q) => q.text)).toEqual([
      'Qual tipo de serviço?',
      'Deseja informar o KM inicial?',
      'Deseja informar a hora inicial?',
      'Cliente presente?',
      'Foi necessário lançar ramal?',
      'Foi instalado medidor? Se sim qual número?',
      'Foi retirado medidor? Se sim qual número?',
      'Qual leitura do medidor instalado?',
      'Qual leitura do medidor retirado?',
      'Deseja informar o KM final?',
      'Deseja informar o horário final?',
      'Houve alguma dificuldade na execução desse serviço? Se sim relate!',
    ]);
  });

  it('ids únicos e só a pergunta dos DITAIS é obrigatória', () => {
    for (const type of ['COMERCIAL', 'OCORRENCIA'] as const) {
      const ids = questionsFor(type).map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const required = [...questionsFor('OCORRENCIA'), ...questionsFor('COMERCIAL')].filter((q) => q.required);
    expect(required.map((q) => q.id)).toEqual(['ditais']);
    expect(required[0]?.isDitais).toBe(true);
  });
});

describe('OS nova (tela da OS)', () => {
  const agora = new Date('2026-11-20T10:00:00Z');

  it('OS nova começa em branco: sem número (S/N), sem código e sem respostas', () => {
    expect(ordem.startDraft('OCORRENCIA')).toEqual({ osNumber: '', serviceType: 'OCORRENCIA', serviceCode: '', answers: {} });
  });

  it('salva com número, código e respostas normalizadas; número vazio vira S/N', () => {
    const d = ordem.startDraft('COMERCIAL');
    const r = ordem.createOS({ ...d, osNumber: ' 555 ', serviceCode: ' 709 ', answers: { tipo: { kind: 'text', value: '  Ligação nova  ' }, dificuldade: { kind: 'choice', choice: 'Não' } } }, 'id-1', agora);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.os).toMatchObject({ id: 'id-1', osNumber: '555', serviceType: 'COMERCIAL', serviceCode: '709', registradaEm: '2026-11-20T10:00:00.000Z' });
    expect(Object.keys(r.os.answers)).toHaveLength(12);
    expect(r.os.answers.tipo).toEqual({ kind: 'text', value: 'Ligação nova' });
    expect(r.os.answers.kmIni).toEqual({ kind: 'skipped' });
    const sn = ordem.createOS({ ...d, serviceCode: '709' }, 'id-2', agora);
    expect(sn.ok && sn.os.osNumber).toBe('');
  });

  it('ocorrência: o número do topo vai para a pergunta do número', () => {
    const d = { ...ordem.startDraft('OCORRENCIA'), serviceCode: '508' };
    const r = ordem.createOS({ ...d, osNumber: '4455', answers: { ditais: { kind: 'choice', choice: 'Não' } } }, 'x', agora);
    expect(r.ok && r.os.osNumber).toBe('4455');
    expect(r.ok && r.os.answers.os).toEqual({ kind: 'text', value: '4455' });
  });

  it('mesmas regras da edição: DITAIS obrigatória, complemento do SIM e código', () => {
    const d = { ...ordem.startDraft('OCORRENCIA'), serviceCode: '508' };
    const semDitais = ordem.createOS(d, 'x', agora);
    expect(semDitais.ok).toBe(false);
    if (!semDitais.ok) expect(semDitais.field).toBe('ditais');
    const semComplemento = ordem.createOS({ ...d, answers: { ditais: { kind: 'choice', choice: 'Sim' }, dificuldade: { kind: 'choice', choice: 'Sim', detail: ' ' } } }, 'x', agora);
    expect(semComplemento.ok).toBe(false);
    if (!semComplemento.ok) expect(semComplemento.field).toBe('dificuldade');
    expect(ordem.createOS({ ...d, serviceCode: ' ', answers: { ditais: { kind: 'choice', choice: 'Não' } } }, 'x', agora)).toMatchObject({ ok: false, field: ordem.CODE_FIELD });
    // Código da lista do outro tipo: a OS teria as perguntas erradas.
    const trocado = ordem.createOS({ ...d, serviceCode: '709', answers: { ditais: { kind: 'choice', choice: 'Não' } } }, 'x', agora);
    expect(trocado).toMatchObject({ ok: false, field: ordem.CODE_FIELD });
    if (!trocado.ok) expect(trocado.error).toContain('COMERCIAL');
  });

  it('"Sim, qual?": NÃO descarta o complemento; SIM mantém o que já foi digitado', () => {
    const q = questionsFor('COMERCIAL').find((x) => x.id === 'medidorInst')!;
    const sim = { kind: 'choice', choice: 'Sim', detail: 'MED-1' } as const;
    expect(ordem.choiceAnswer(q, sim, 'Não')).toEqual({ kind: 'choice', choice: 'Não' });
    expect(ordem.choiceAnswer(q, sim, 'Sim')).toEqual(sim);
  });

  it('finalize transforma respostas incompletas em "pulada"', () => {
    const d: OSDraft = {
      osNumber: '1',
      serviceType: 'OCORRENCIA',
      serviceCode: '508',
      answers: { tipo: { kind: 'text', value: '  ' }, dificuldade: { kind: 'choice', choice: 'Sim', detail: '' }, callback: { kind: 'text', value: 'x' } },
    };
    const os = ordem.finalize(d, 'x', new Date());
    expect(os.answers.tipo).toEqual({ kind: 'skipped' });
    expect(os.answers.dificuldade).toEqual({ kind: 'skipped' });
    expect(os.answers.callback).toEqual({ kind: 'skipped' });
  });

  it('isUnchanged: OS recém-aberta sai sem confirmação; número, texto ou SIM/NÃO contam como preenchido', () => {
    const d = ordem.startDraft('OCORRENCIA');
    expect(ordem.isUnchanged(d)).toBe(true);
    expect(ordem.isUnchanged({ ...d, serviceCode: '508' })).toBe(false);
    expect(ordem.isUnchanged({ ...d, answers: { tipo: { kind: 'text', value: '' } } })).toBe(true); // texto apagado
    expect(ordem.isUnchanged({ ...d, osNumber: '12' })).toBe(false);
    expect(ordem.isUnchanged({ ...d, answers: { callback: { kind: 'choice', choice: 'Sim' } } })).toBe(false);
    expect(ordem.isUnchanged({ ...d, answers: { tipo: { kind: 'text', value: 'Falta' } } })).toBe(false);
  });

  it('answerRows descreve cada pergunta para o app', () => {
    const os = finishedOS('7', 'OCORRENCIA', '503', { ditais: { kind: 'choice', choice: 'Sim' }, dificuldade: { kind: 'choice', choice: 'Sim', detail: 'Chuva' } });
    const rows = ordem.answerRows(os);
    expect(rows).toHaveLength(14);
    expect(rows[0]).toEqual({ question: 'Tentou callback?', display: 'Não informado', skipped: true, isDitais: false });
    expect(rows[7]).toMatchObject({ display: 'Sim', isDitais: true, skipped: false });
    expect(rows[13]?.display).toBe('Sim — Chuva');
  });
});

describe('edição completa de OS (lápis)', () => {
  const base = () => finishedOS('100', 'OCORRENCIA', '508', { ditais: { kind: 'choice', choice: 'Não' }, tipo: { kind: 'text', value: 'Falta' } }, 'id-9');

  it('altera número, código e respostas mantendo id e horário de registro', () => {
    const os = base();
    const r = ordem.applyEdit(os, { osNumber: ' 101 ', serviceCode: ' 509 ', answers: { ...os.answers, tipo: { kind: 'text', value: 'Religação' }, kmIni: { kind: 'text', value: '45210' } } });
    if (!r.ok) throw new Error(r.error);
    expect(r.os).toMatchObject({ id: 'id-9', osNumber: '101', serviceCode: '509', registradaEm: os.registradaEm });
    expect(r.os.answers.os).toEqual({ kind: 'text', value: '101' });
    expect(r.os.answers.tipo).toEqual({ kind: 'text', value: 'Religação' });
    expect(r.os.answers.kmIni).toEqual({ kind: 'text', value: '45210' });
  });

  it('mantém as respostas da versão antiga (infoLegada) e as mostra em "Ver respostas"', () => {
    const os = { ...base(), infoLegada: 'Medidor instalado: M-1' };
    const r = ordem.applyEdit(os, { osNumber: '100', serviceCode: '508', answers: os.answers });
    if (!r.ok) throw new Error(r.error);
    expect(r.os.infoLegada).toBe('Medidor instalado: M-1');
    expect(ordem.answerRows(r.os).at(-1)).toMatchObject({ display: 'Medidor instalado: M-1' });
  });

  it('número vazio vira S/N e a pergunta do número fica pulada', () => {
    const os = base();
    const r = ordem.applyEdit(os, { osNumber: '  ', serviceCode: '508', answers: os.answers });
    if (!r.ok) throw new Error(r.error);
    expect(r.os.osNumber).toBe('');
    expect(r.os.answers.os).toEqual({ kind: 'skipped' });
  });

  it('aplica as regras: código obrigatório, DITAIS obrigatória e complemento do SIM', () => {
    const os = base();
    expect(ordem.applyEdit(os, { osNumber: '1', serviceCode: ' ', answers: os.answers }).ok).toBe(false);
    const semDitais = ordem.applyEdit(os, { osNumber: '1', serviceCode: '508', answers: { ...os.answers, ditais: { kind: 'skipped' } } });
    expect(semDitais).toMatchObject({ ok: false, field: 'ditais' });
    const semComplemento = ordem.applyEdit(os, { osNumber: '1', serviceCode: '508', answers: { ...os.answers, dificuldade: { kind: 'choice', choice: 'Sim', detail: ' ' } } });
    expect(semComplemento).toMatchObject({ ok: false, field: 'dificuldade' });
  });
});
