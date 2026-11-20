import { describe, expect, it } from 'vitest';
import { questionsFor } from '../../src/domain/catalog';
import type { WizardDraft } from '../../src/domain/types';
import * as wiz from '../../src/domain/wizard';

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
  it('tem 3 perguntas comerciais e 18 de ocorrência, com ids únicos', () => {
    expect(questionsFor('COMERCIAL')).toHaveLength(3);
    expect(questionsFor('OCORRENCIA')).toHaveLength(18);
    for (const type of ['COMERCIAL', 'OCORRENCIA'] as const) {
      const ids = questionsFor(type).map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('só a pergunta dos DITAIS é obrigatória', () => {
    const required = questionsFor('OCORRENCIA').filter((q) => q.required);
    expect(required.map((q) => q.id)).toEqual(['o6']);
    expect(required[0]?.isDitais).toBe(true);
  });
});

describe('assistente', () => {
  it('pré-preenche o número da OS na pergunta 2 de ocorrência', () => {
    const d = wiz.startDraft('998877', 'OCORRENCIA', '508');
    expect(d.answers.o2).toEqual({ kind: 'text', value: '998877' });
    expect(wiz.startDraft('1', 'COMERCIAL', '28').answers).toEqual({});
  });

  it('OS sem número (S/N) não pré-preenche e adota o número respondido na pergunta 2', () => {
    const d = wiz.startDraft('', 'OCORRENCIA', '508');
    expect(d.answers).toEqual({});
    expect(wiz.finalize(d, 'a', new Date()).osNumber).toBe('');
    const answered = { ...d, answers: { o2: { kind: 'text' as const, value: ' 4455 ' } } };
    expect(wiz.finalize(answered, 'b', new Date()).osNumber).toBe('4455');
  });

  it('corrigir a pergunta 2 corrige o número da OS; pulá-la mantém o número do painel', () => {
    const d = wiz.startDraft('100', 'OCORRENCIA', '508');
    expect(wiz.finalize({ ...d, answers: { o2: { kind: 'text', value: '200' } } }, 'x', new Date()).osNumber).toBe('200');
    expect(wiz.finalize({ ...d, answers: { o2: { kind: 'skipped' } } }, 'x', new Date()).osNumber).toBe('100');

    // Edição de OS concluída: o número e a resposta da pergunta 2 não podem divergir.
    const os = wiz.finalize(d, 'id', new Date());
    const onO2 = { ...wiz.draftFromOS(os), index: 1 }; // pergunta 2 = número da OS
    const edited = wiz.finalize(wiz.setText(onO2, '101'), 'id', new Date());
    expect(edited.osNumber).toBe('101');
    expect(edited.answers.o2).toEqual({ kind: 'text', value: '101' });
  });

  it('editar o número depois mantém a pergunta 2 coerente', () => {
    const os = wiz.finalize(wiz.startDraft('', 'OCORRENCIA', '508'), 'x', new Date());
    const comNumero = wiz.withOSNumber(os, ' 777 ');
    expect(comNumero.osNumber).toBe('777');
    expect(comNumero.answers.o2).toEqual({ kind: 'text', value: '777' });
    const semNumero = wiz.withOSNumber(comNumero, '  ');
    expect(semNumero.osNumber).toBe('');
    expect(semNumero.answers.o2).toEqual({ kind: 'skipped' });

    const comercial = wiz.finalize(wiz.startDraft('', 'COMERCIAL', '28'), 'y', new Date());
    expect(wiz.withOSNumber(comercial, '9').answers).toEqual(comercial.answers);
  });

  it('não avança com texto vazio e apara espaços', () => {
    let d = wiz.startDraft('1', 'COMERCIAL', '28');
    expect(wiz.next(d).ok).toBe(false);
    d = wiz.setText(d, '   ');
    expect(wiz.next(d).ok).toBe(false);
    d = wiz.setText(d, '  Ligação nova  ');
    const r = ok(wiz.next(d));
    expect(r.draft.index).toBe(1);
    expect(r.draft.answers.c1).toEqual({ kind: 'text', value: 'Ligação nova' });
  });

  it('não deixa pular nem avançar sem resposta na pergunta dos DITAIS', () => {
    const d = goTo(wiz.startDraft('1', 'OCORRENCIA', '508'), 'o6');
    const skipped = wiz.skip(d);
    expect(skipped.ok).toBe(false);
    expect(wiz.next(d).ok).toBe(false);
    expect(ok(wiz.next(wiz.setChoice(d, 'Não'))).draft.index).toBe(d.index + 1);
  });

  it('exige o complemento quando a resposta com detalhe é SIM', () => {
    const d = goTo(wiz.startDraft('1', 'OCORRENCIA', '508'), 'o12');
    const sim = wiz.setChoice(d, 'Sim');
    const r = wiz.next(sim);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.focus).toBe('detail');
    const filled = ok(wiz.next(wiz.setDetail(sim, ' 123ABC ')));
    expect(filled.draft.answers.o12).toEqual({ kind: 'choice', choice: 'Sim', detail: '123ABC' });
  });

  it('trocar para NÃO descarta o complemento, e voltar para SIM o recupera do rascunho', () => {
    const d = goTo(wiz.startDraft('1', 'OCORRENCIA', '508'), 'o11');
    const sim = wiz.setDetail(wiz.setChoice(d, 'Sim'), 'chuva');
    const nao = wiz.setChoice(sim, 'Não');
    expect(nao.answers.o11).toEqual({ kind: 'choice', choice: 'Não' });
    expect(ok(wiz.next(nao)).draft.answers.o11).toEqual({ kind: 'choice', choice: 'Não' });
  });

  it('setDetail é ignorado se a escolha não for SIM', () => {
    const d = goTo(wiz.startDraft('1', 'OCORRENCIA', '508'), 'o11');
    expect(wiz.setDetail(d, 'x')).toBe(d);
  });

  it('voltar mantém as respostas e não passa da primeira pergunta', () => {
    let d = wiz.startDraft('1', 'COMERCIAL', '28');
    expect(wiz.back(d)).toBe(d);
    d = ok(wiz.next(wiz.setText(d, 'Corte'))).draft;
    d = wiz.back(d);
    expect(d.index).toBe(0);
    expect(d.answers.c1).toEqual({ kind: 'text', value: 'Corte' });
  });

  it('sinaliza fim na última pergunta e finaliza com todas as respostas normalizadas', () => {
    let d = wiz.startDraft('555', 'COMERCIAL', '709');
    d = ok(wiz.next(wiz.setText(d, 'Religação'))).draft;
    d = ok(wiz.skip(d)).draft;
    expect(wiz.isLastQuestion(d)).toBe(true);
    const last = ok(wiz.next(wiz.setChoice(d, 'Sim')));
    expect(last.done).toBe(true);

    const os = wiz.finalize(last.draft, 'id-1', new Date('2026-11-20T10:00:00Z'));
    expect(os).toMatchObject({ id: 'id-1', osNumber: '555', serviceType: 'COMERCIAL', serviceCode: '709', registradaEm: '2026-11-20T10:00:00.000Z' });
    expect(os.answers).toEqual({
      c1: { kind: 'text', value: 'Religação' },
      c2: { kind: 'skipped' },
      c3: { kind: 'choice', choice: 'Sim' },
    });
  });

  it('finalize transforma respostas incompletas em "pulada"', () => {
    const d: WizardDraft = {
      osNumber: '1',
      serviceType: 'OCORRENCIA',
      serviceCode: '508',
      index: 17,
      answers: { o1: { kind: 'text', value: '  ' }, o11: { kind: 'choice', choice: 'Sim', detail: '' }, o3: { kind: 'text', value: 'x' } },
    };
    const os = wiz.finalize(d, 'x', new Date());
    expect(os.answers.o1).toEqual({ kind: 'skipped' });
    expect(os.answers.o11).toEqual({ kind: 'skipped' });
    expect(os.answers.o3).toEqual({ kind: 'skipped' });
    expect(Object.keys(os.answers)).toHaveLength(18);
  });

  it('editar uma OS reabre o assistente com as respostas e o id originais', () => {
    const os = wiz.finalize(wiz.setText(wiz.startDraft('9', 'COMERCIAL', '33'), 'Troca'), 'abc', new Date());
    const d = wiz.draftFromOS(os);
    expect(d).toMatchObject({ editingId: 'abc', index: 0, osNumber: '9', serviceCode: '33' });
    expect(d.answers.c1).toEqual({ kind: 'text', value: 'Troca' });
  });

  it('answerRows descreve cada pergunta para o app e o PDF', () => {
    const os = wiz.finalize(
      { ...wiz.startDraft('7', 'OCORRENCIA', '503'), answers: { o2: { kind: 'text', value: '7' }, o6: { kind: 'choice', choice: 'Sim' }, o12: { kind: 'choice', choice: 'Sim', detail: 'M-42' } } },
      'x',
      new Date(),
    );
    const rows = wiz.answerRows(os);
    expect(rows).toHaveLength(18);
    expect(rows[0]).toEqual({ question: 'Qual tipo de serviço?', display: 'Não informado', skipped: true, isDitais: false });
    expect(rows[5]).toMatchObject({ display: 'Sim', isDitais: true, skipped: false });
    expect(rows[11]?.display).toBe('Sim — M-42');
  });
});
