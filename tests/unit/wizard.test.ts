import { describe, expect, it } from 'vitest';
import { questionsFor } from '../../src/domain/catalog';
import type { WizardDraft } from '../../src/domain/types';
import * as wiz from '../../src/domain/wizard';
import { finishedOS } from './fixtures';

/** Avança até a pergunta de id informado, pulando as anteriores (DITAIS respondida com NÃO). */
function goTo(draft: WizardDraft, id: string): WizardDraft {
  let d = draft;
  while (wiz.currentQuestion(d).id !== id) {
    const r = wiz.currentQuestion(d).required ? wiz.next(wiz.setChoice(d, 'Não')) : wiz.skip(d);
    if (!r.ok || r.done) throw new Error(`não chegou em ${id}`);
    d = r.draft;
  }
  return d;
}

function ok(r: wiz.StepResult) {
  if (!r.ok) throw new Error(`esperava sucesso, veio: ${r.error}`);
  return r;
}

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

describe('assistente', () => {
  it('pré-preenche o número da OS na pergunta do número (só ocorrência)', () => {
    expect(wiz.startDraft('998877', 'OCORRENCIA', '508').answers).toEqual({ os: { kind: 'text', value: '998877' } });
    expect(wiz.startDraft('1', 'COMERCIAL', '28').answers).toEqual({});
  });

  it('OS sem número (S/N) adota o número respondido; corrigir a resposta corrige o número', () => {
    const sn = wiz.startDraft('', 'OCORRENCIA', '508');
    expect(sn.answers).toEqual({});
    expect(wiz.finalize(sn, 'a', new Date()).osNumber).toBe('');
    expect(wiz.finalize({ ...sn, answers: { os: { kind: 'text', value: ' 4455 ' } } }, 'b', new Date()).osNumber).toBe('4455');

    const d = wiz.startDraft('100', 'OCORRENCIA', '508');
    expect(wiz.finalize({ ...d, answers: { os: { kind: 'text', value: '200' } } }, 'x', new Date()).osNumber).toBe('200');
    expect(wiz.finalize({ ...d, answers: { os: { kind: 'skipped' } } }, 'x', new Date()).osNumber).toBe('100');
  });

  it('não avança com texto vazio e apara espaços', () => {
    let d = wiz.startDraft('1', 'COMERCIAL', '28');
    expect(wiz.next(d).ok).toBe(false);
    d = wiz.setText(d, '   ');
    expect(wiz.next(d).ok).toBe(false);
    const r = ok(wiz.next(wiz.setText(d, '  Ligação nova  ')));
    expect(r.draft.index).toBe(1);
    expect(r.draft.answers.tipo).toEqual({ kind: 'text', value: 'Ligação nova' });
  });

  it('não deixa pular nem avançar sem resposta na pergunta dos DITAIS', () => {
    const d = goTo(wiz.startDraft('1', 'OCORRENCIA', '508'), 'ditais');
    expect(wiz.skip(d).ok).toBe(false);
    expect(wiz.next(d).ok).toBe(false);
    expect(ok(wiz.next(wiz.setChoice(d, 'Não'))).draft.index).toBe(d.index + 1);
  });

  it('exige o complemento quando a resposta "se sim, qual" é SIM; NÃO descarta o complemento', () => {
    const d = goTo(wiz.startDraft('1', 'COMERCIAL', '709'), 'medidorInst');
    const sim = wiz.setChoice(d, 'Sim');
    const r = wiz.next(sim);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.focus).toBe('detail');
    expect(ok(wiz.next(wiz.setDetail(sim, ' 123ABC '))).draft.answers.medidorInst).toEqual({ kind: 'choice', choice: 'Sim', detail: '123ABC' });
    expect(wiz.setChoice(wiz.setDetail(sim, 'x'), 'Não').answers.medidorInst).toEqual({ kind: 'choice', choice: 'Não' });
    expect(wiz.setDetail(d, 'x')).toBe(d);
  });

  it('voltar mantém as respostas e não passa da primeira pergunta', () => {
    let d = wiz.startDraft('1', 'COMERCIAL', '28');
    expect(wiz.back(d)).toBe(d);
    d = ok(wiz.next(wiz.setText(d, 'Corte'))).draft;
    d = wiz.back(d);
    expect(d.index).toBe(0);
    expect(d.answers.tipo).toEqual({ kind: 'text', value: 'Corte' });
  });

  it('sinaliza fim na última pergunta e finaliza com todas as respostas normalizadas', () => {
    let d = goTo(wiz.startDraft('555', 'COMERCIAL', '709'), 'dificuldade');
    expect(wiz.isLastQuestion(d)).toBe(true);
    d = wiz.setChoice(d, 'Não');
    const last = ok(wiz.next(d));
    expect(last.done).toBe(true);
    const os = wiz.finalize(last.draft, 'id-1', new Date('2026-11-20T10:00:00Z'));
    expect(os).toMatchObject({ id: 'id-1', osNumber: '555', serviceType: 'COMERCIAL', serviceCode: '709', registradaEm: '2026-11-20T10:00:00.000Z' });
    expect(Object.keys(os.answers)).toHaveLength(12);
    expect(os.answers.tipo).toEqual({ kind: 'skipped' });
    expect(os.answers.dificuldade).toEqual({ kind: 'choice', choice: 'Não' });
  });

  it('finalize transforma respostas incompletas em "pulada"', () => {
    const d: WizardDraft = {
      osNumber: '1',
      serviceType: 'OCORRENCIA',
      serviceCode: '508',
      index: 11,
      answers: { tipo: { kind: 'text', value: '  ' }, dificuldade: { kind: 'choice', choice: 'Sim', detail: '' }, callback: { kind: 'text', value: 'x' } },
    };
    const os = wiz.finalize(d, 'x', new Date());
    expect(os.answers.tipo).toEqual({ kind: 'skipped' });
    expect(os.answers.dificuldade).toEqual({ kind: 'skipped' });
    expect(os.answers.callback).toEqual({ kind: 'skipped' });
  });

  it('isUnchanged: nada além do pré-preenchido; texto apagado conta como não respondido', () => {
    const d = wiz.startDraft('5', 'OCORRENCIA', '508');
    expect(wiz.isUnchanged(d)).toBe(true);
    expect(wiz.isUnchanged(wiz.setChoice(d, 'Sim'))).toBe(false); // callback = Sim
    const noTexto = goTo(d, 'horaIni');
    expect(wiz.isUnchanged(wiz.setText(noTexto, ''))).toBe(false); // callback foi pulada (resposta dada)
    expect(wiz.isUnchanged({ ...d, answers: { ...d.answers, tipo: { kind: 'text', value: '' } } })).toBe(true);
  });

  it('answerRows descreve cada pergunta para o app', () => {
    const os = finishedOS('7', 'OCORRENCIA', '503', { ditais: { kind: 'choice', choice: 'Sim' }, dificuldade: { kind: 'choice', choice: 'Sim', detail: 'Chuva' } });
    const rows = wiz.answerRows(os);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ question: 'Tentou callback?', display: 'Não informado', skipped: true, isDitais: false });
    expect(rows[7]).toMatchObject({ display: 'Sim', isDitais: true, skipped: false });
    expect(rows[11]?.display).toBe('Sim — Chuva');
  });
});

describe('edição completa de OS (lápis)', () => {
  const base = () => finishedOS('100', 'OCORRENCIA', '508', { ditais: { kind: 'choice', choice: 'Não' }, tipo: { kind: 'text', value: 'Falta' } }, 'id-9');

  it('altera número, código e respostas mantendo id e horário de registro', () => {
    const os = base();
    const r = wiz.applyEdit(os, { osNumber: ' 101 ', serviceCode: ' 509 ', answers: { ...os.answers, tipo: { kind: 'text', value: 'Religação' }, kmIni: { kind: 'text', value: '45210' } } });
    if (!r.ok) throw new Error(r.error);
    expect(r.os).toMatchObject({ id: 'id-9', osNumber: '101', serviceCode: '509', registradaEm: os.registradaEm });
    expect(r.os.answers.os).toEqual({ kind: 'text', value: '101' });
    expect(r.os.answers.tipo).toEqual({ kind: 'text', value: 'Religação' });
    expect(r.os.answers.kmIni).toEqual({ kind: 'text', value: '45210' });
  });

  it('mantém as respostas da versão antiga (infoLegada) e as mostra em "Ver respostas"', () => {
    const os = { ...base(), infoLegada: 'Medidor instalado: M-1' };
    const r = wiz.applyEdit(os, { osNumber: '100', serviceCode: '508', answers: os.answers });
    if (!r.ok) throw new Error(r.error);
    expect(r.os.infoLegada).toBe('Medidor instalado: M-1');
    expect(wiz.answerRows(r.os).at(-1)).toMatchObject({ display: 'Medidor instalado: M-1' });
  });

  it('número vazio vira S/N e a pergunta do número fica pulada', () => {
    const os = base();
    const r = wiz.applyEdit(os, { osNumber: '  ', serviceCode: '508', answers: os.answers });
    if (!r.ok) throw new Error(r.error);
    expect(r.os.osNumber).toBe('');
    expect(r.os.answers.os).toEqual({ kind: 'skipped' });
  });

  it('aplica as regras: código obrigatório, DITAIS obrigatória e complemento do SIM', () => {
    const os = base();
    expect(wiz.applyEdit(os, { osNumber: '1', serviceCode: ' ', answers: os.answers }).ok).toBe(false);
    const semDitais = wiz.applyEdit(os, { osNumber: '1', serviceCode: '508', answers: { ...os.answers, ditais: { kind: 'skipped' } } });
    expect(semDitais).toMatchObject({ ok: false, questionId: 'ditais' });
    const semComplemento = wiz.applyEdit(os, { osNumber: '1', serviceCode: '508', answers: { ...os.answers, dificuldade: { kind: 'choice', choice: 'Sim', detail: ' ' } } });
    expect(semComplemento).toMatchObject({ ok: false, questionId: 'dificuldade' });
  });
});
