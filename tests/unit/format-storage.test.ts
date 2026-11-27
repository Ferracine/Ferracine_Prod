import { describe, expect, it } from 'vitest';
import { espelhoRows } from '../../src/domain/espelho';
import { formatDateBR, formatHorario, mesmaPessoa, osLabel, sheetFileName, sheetLabel, todayISO } from '../../src/domain/format';
import type { AppData } from '../../src/domain/types';
import { espelhoMaisNovo } from '../../src/espelho';
import { cancelarDados, emptyData, encerrarDados, type KeyValueStore, lerSeq, SEQ_KEY, loadData, pushSheet, reabrirDados, removerFolha, saveData, STORAGE_KEY } from '../../src/storage';
import { startDraft } from '../../src/domain/ordem';
import { baseHeader as header, finishedOS } from './fixtures';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
}

describe('formatação', () => {
  it('converte datas sem depender do fuso', () => {
    expect(formatDateBR('2026-01-05')).toBe('05/01/2026');
    expect(formatDateBR('texto livre')).toBe('texto livre');
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('monta o horário', () => {
    expect(formatHorario(header)).toBe('07:00 às 17:00');
  });

  it('mostra S/N para OS sem número', () => {
    expect(osLabel('')).toBe('S/N');
    expect(osLabel('123')).toBe('123');
  });

  it('nomeia o PDF com os nomes da equipe e a quantidade de serviços', () => {
    expect(sheetFileName(header, 1)).toBe('Joao_da_Silva_20-11-2026_1_servico.pdf');
    expect(sheetFileName({ ...header, nome2: '  Ângelo  Souza ' }, 3)).toBe('Joao_da_Silva_Angelo_Souza_20-11-2026_3_servicos.pdf');
    expect(sheetFileName({ ...header, nome1: '###' }, 0)).toBe('Equipe_20-11-2026_0_servicos.pdf');
    expect(sheetFileName({ ...header, data: '' }, 2)).toBe('Joao_da_Silva_2_servicos.pdf');
  });
});

describe('armazenamento', () => {
  it('começa vazio sem dados, com JSON corrompido ou de outra versão', () => {
    expect(loadData(memoryStore())).toEqual(emptyData());
    expect(loadData(memoryStore({ [STORAGE_KEY]: '{quebrado' }))).toEqual(emptyData());
    expect(loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ version: 1, ordens: [] }) }))).toEqual(emptyData());
    expect(loadData(memoryStore({ [STORAGE_KEY]: 'null' }))).toEqual(emptyData());
  });

  it('sobrevive a localStorage indisponível', () => {
    const broken: KeyValueStore = {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('QuotaExceededError'); },
      removeItem() { throw new Error('SecurityError'); },
    };
    expect(loadData(broken)).toEqual(emptyData());
    expect(saveData(broken, emptyData())).toBe(false);
  });

  it('salva e recarrega o turno com rascunho, última folha, último cabeçalho e técnicos', () => {
    const store = memoryStore();
    const tecnicos = [{ id: 't1', nome: 'TEC. ANA', telefone: '69 9999-0000' }];
    const data: AppData = {
      version: 3,
      header: { ...header, equipe: 'PVH-01', viatura: 'ABC1D23', bodycam2: 'BC-9', lider: 't1' },
      ordens: [{ id: '1', osNumber: '10', serviceType: 'COMERCIAL', serviceCode: '28', answers: { tipo: { kind: 'skipped' } }, registradaEm: '2026-11-20T10:00:00.000Z' }],
      draft: { osNumber: '', serviceType: 'OCORRENCIA', serviceCode: '508', answers: {} },
      sheets: [{ header, ordens: [], fechadaEm: '2026-11-19T20:00:00.000Z', tecnicos, baixadaEm: '' }],
      eletricistas: [{ id: 'e1', nome: 'ANA', matricula: '1' }],
      lastHeader: header,
      tecnicos,
      reaberta: { header, ordens: [], fechadaEm: '2026-11-18T20:00:00.000Z', tecnicos, baixadaEm: '2026-11-18T21:00:00.000Z' },
      tecnicosDaReaberta: ['t1'],
    };
    expect(saveData(store, data)).toBe(true);
    expect(store.items.get(STORAGE_KEY)).toContain('"version":3');
    expect(loadData(store)).toEqual(data);
  });

  it('rascunho do antigo assistente: o número respondido na pergunta do número vai para o campo do topo', () => {
    const antigo = { ...emptyData(), draft: { osNumber: '', serviceType: 'OCORRENCIA', serviceCode: '508', index: 4, answers: { os: { kind: 'text', value: ' 123 ' } } } };
    const migrado = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify(antigo) })).draft;
    expect(migrado?.osNumber).toBe('123');
    // A resposta antiga sai do rascunho: o número corrigido depois no campo do topo não volta para "123" ao reabrir.
    expect(migrado?.answers.os).toBeUndefined();
    const corrigido = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), draft: { ...migrado, osNumber: '456' } }) }));
    expect(corrigido.draft?.osNumber).toBe('456');
    const semResposta = { ...emptyData(), draft: { osNumber: '9', serviceType: 'COMERCIAL', serviceCode: '28', answers: {} } };
    expect(loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify(semResposta) })).draft?.osNumber).toBe('9');
  });

  it('OS ou rascunho estragado (gravação cortada, edição à mão) é descartado ou completado em vez de travar o app', () => {
    const boa = { id: 'b', osNumber: '1', serviceType: 'COMERCIAL', serviceCode: '28', registradaEm: 'x', answers: {} };
    const salvo = { ...emptyData(), ordens: [null, 'x', { ...boa, serviceType: 'OUTRO' }, { ...boa, answers: null }, { ...boa, id: undefined }, boa], draft: { osNumber: '', serviceType: 'X', serviceCode: '', answers: {} } };
    const loaded = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify(salvo) }));
    expect(loaded.ordens.map((o) => o.id)).toEqual(['b']);
    expect(loaded.draft).toBeNull();
    // Rascunho sem número e sem código (só tipo e respostas): campos vazios, a tela da OS abre e salva normalmente.
    const semTexto = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), draft: { serviceType: 'COMERCIAL', answers: {} } }) }));
    expect(semTexto.draft).toEqual({ osNumber: '', serviceType: 'COMERCIAL', serviceCode: '', answers: {} });
  });

  it('dado de versão anterior é gravado no formato atual já ao abrir; a chave do protótipo (v2) é apagada', () => {
    const os = { id: 'o', osNumber: '7', serviceType: 'OCORRENCIA', serviceCode: '508', registradaEm: 'x', answers: { os: { kind: 'text', value: '7' } }, infoLegada: 'velho' };
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ version: 3, header: null, ordens: [os], draft: null, lastSheet: null, lastHeader: null }), 'ferracine_prod:v2': '{"x":1}' });
    const loaded = loadData(store);
    expect(loaded.ordens[0]).toEqual({ id: 'o', osNumber: '7', serviceType: 'OCORRENCIA', serviceCode: '508', registradaEm: 'x', answers: {} });
    expect(JSON.parse(store.items.get(STORAGE_KEY)!)).toEqual(loaded);
    expect(store.items.has('ferracine_prod:v2')).toBe(false);
    // Já no formato atual: abrir de novo não regrava.
    let gravacoes = 0;
    store.setItem = () => void gravacoes++;
    expect(loadData(store)).toEqual(loaded);
    expect(gravacoes).toBe(0);
  });

  it('técnicos, eletricistas e cabeçalho: item com campo que não é texto sai; campo extra sai; campo novo do cabeçalho vem vazio', () => {
    const salvo = {
      ...emptyData(),
      tecnicos: [{ id: 't1', nome: 'TEC. ANA', telefone: '1', extra: 'x' }, { id: 't2', nome: 'TEC. BIA', telefone: 2 }, null],
      eletricistas: [{ id: 'e1', nome: 'ANA', matricula: '' }, { id: 'e2', nome: 'BIA' }],
      header: { nome1: 'ANA', data: '2026-11-20', bodycam2: 7 },
      lastHeader: 'estragado',
    };
    const loaded = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify(salvo) }));
    expect(loaded.tecnicos).toEqual([{ id: 't1', nome: 'TEC. ANA', telefone: '1' }]);
    expect(loaded.eletricistas).toEqual([{ id: 'e1', nome: 'ANA', matricula: '' }]);
    expect(loaded.header).toMatchObject({ nome1: 'ANA', data: '2026-11-20', equipe: '', bodycam2: '', lider: '' });
    expect(Object.keys(loaded.header!)).toHaveLength(12);
    expect(loaded.lastHeader).toBeNull();
  });

  it('dado gravado pelo próprio app já está no formato atual: abrir não regrava (mesma ordem de campos)', () => {
    const os = finishedOS('1', 'COMERCIAL', '28', {}, 'id-1');
    const data: AppData = {
      ...emptyData(),
      header,
      ordens: [os],
      draft: { ...startDraft('OCORRENCIA'), serviceCode: '508' },
      sheets: [{ header, ordens: [os], fechadaEm: '2026-11-19T20:00:00.000Z', tecnicos: [{ id: 't', nome: 'TEC', telefone: '1' }], baixadaEm: '' }],
      lastHeader: header,
      eletricistas: [{ id: 'e', nome: 'ANA', matricula: '1' }],
    };
    // Uma folha montada pelo próprio encerramento (a ordem dos campos tem de bater com o esquema FOLHA).
    const turno: AppData = { ...emptyData(), header, ordens: [os], tecnicos: data.tecnicos };
    encerrarDados(turno, '2026-11-20T20:00:00.000Z');
    data.sheets = [...turno.sheets, ...data.sheets];
    const store = memoryStore();
    saveData(store, data);
    let gravacoes = 0;
    store.setItem = () => void gravacoes++;
    expect(loadData(store)).toEqual(data);
    expect(gravacoes).toBe(0);
  });

  it('conversões antigas valem também nas OSs das folhas do histórico', () => {
    const antiga = { id: 'o', osNumber: '1', serviceType: 'OCORRENCIA', serviceCode: '508', registradaEm: 'x', answers: { medidorInst: { kind: 'text', value: 'D60' }, os: { kind: 'text', value: '1' } } };
    const salvo = { version: 3, header: null, ordens: [], draft: null, lastHeader: null, lastSheet: { header, ordens: [antiga], fechadaEm: 'x', tecnicos: [] } };
    const [folha] = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify(salvo) })).sheets;
    expect(folha?.ordens[0]?.answers).toEqual({ medidorInstNum: { kind: 'text', value: 'D60' } });
  });

  it('até a 1.4.12: "Houve alguma dificuldade?" SIM + relato vira a caixa Informações adicionais; o NÃO some', () => {
    const base = { osNumber: '1', serviceType: 'COMERCIAL', serviceCode: '28', registradaEm: 'x' };
    const sim = { ...base, id: 's', answers: { dificuldade: { kind: 'choice', choice: 'Sim', detail: ' Cachorro solto ' } } };
    const nao = { ...base, id: 'n', answers: { dificuldade: { kind: 'choice', choice: 'Não' } } };
    const draft = { osNumber: '', serviceType: 'OCORRENCIA', serviceCode: '508', answers: { dificuldade: { kind: 'choice', choice: 'Sim', detail: 'Chuva' } } };
    const loaded = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [sim, nao], draft }) }));
    expect(loaded.ordens[0]?.answers).toEqual({ infoAdicional: { kind: 'text', value: 'DIFICULDADE: Cachorro solto' } });
    expect(loaded.ordens[1]?.answers).toEqual({});
    expect(loaded.draft?.answers).toEqual({ infoAdicional: { kind: 'text', value: 'DIFICULDADE: Chuva' } });
  });

  it('ocorrência até a 1.4.17: callback, defeito, dispositivo e alteração na UC vão para o começo de Informações adicionais, com os rótulos do PDF', () => {
    const base = { osNumber: '1', serviceType: 'OCORRENCIA', serviceCode: '508', registradaEm: 'x' };
    const antigas = {
      callback: { kind: 'choice', choice: 'Sim' },
      defeito: { kind: 'text', value: ' FUSÍVEL ' },
      dispositivo: { kind: 'skipped' },
      alteracaoUC: { kind: 'text', value: 'TROCA DE DISJUNTOR' },
      ditais: { kind: 'choice', choice: 'Não' },
    };
    const comInfo = { ...base, id: 'a', answers: { ...antigas, infoAdicional: { kind: 'text', value: 'POSTE ALAGADO' } } };
    const semNada = { ...base, id: 'b', answers: { dispositivo: { kind: 'text', value: '  ' } } };
    const folha = { header, ordens: [comInfo], fechadaEm: 'x', tecnicos: [], baixadaEm: 'x' };
    const loaded = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [comInfo, semNada], sheets: [folha], reaberta: folha }) }));
    const info = 'Callback: Sim; Defeito: FUSÍVEL; Alteração UC: TROCA DE DISJUNTOR; POSTE ALAGADO';
    expect(loaded.ordens[0]?.answers).toEqual({ ditais: { kind: 'choice', choice: 'Não' }, infoAdicional: { kind: 'text', value: info } });
    expect(loaded.ordens[1]?.answers).toEqual({});
    expect(loaded.sheets[0]?.ordens[0]?.answers.infoAdicional).toEqual({ kind: 'text', value: info });
    expect(loaded.reaberta?.ordens[0]?.answers.infoAdicional).toEqual({ kind: 'text', value: info });
    // No PDF continua em INFORMAÇÃO ADICIONAL, com os mesmos rótulos e a mesma grafia de antes.
    expect(espelhoRows(loaded.ordens)[0]?.info).toBe(`DITAIS: Não; ${info}`);
  });

  it('encerrar → editar (reabrir) → encerrar de novo: a folha volta ao turno e depois ao topo do histórico', () => {
    const os = finishedOS('1', 'COMERCIAL', '28', {}, 'o1');
    const antiga = { header: { ...header, nome1: 'VELHA' }, ordens: [], fechadaEm: 'x', tecnicos: [], baixadaEm: 'x' };
    const d: AppData = { ...emptyData(), header, ordens: [os], sheets: [antiga] };
    encerrarDados(d, '2026-11-20T18:00:00.000Z');
    // A folha é montada do turno, ainda sem PDF baixado.
    const folha = { header, ordens: [os], fechadaEm: '2026-11-20T18:00:00.000Z', tecnicos: [], baixadaEm: '' };
    expect(d).toMatchObject({ header: null, ordens: [], draft: null, sheets: [folha, antiga] });
    reabrirDados(d, d.sheets[0]!);
    expect(d).toMatchObject({ header, ordens: [os], draft: null, sheets: [antiga] });
    encerrarDados(d, '2026-11-21T08:00:00.000Z');
    const corrigida = { ...folha, fechadaEm: '2026-11-21T08:00:00.000Z' };
    expect(d.sheets).toEqual([corrigida, antiga]);
    expect(removerFolha(d.sheets, antiga)).toEqual([corrigida]);
    // Sem turno aberto, encerrar não faz nada.
    encerrarDados(d, 'x');
    expect(d.sheets).toEqual([corrigida, antiga]);
  });

  it('cada gravação leva o próximo número; o espelho do IndexedDB só vale se for mais novo que o localStorage', () => {
    const store = memoryStore();
    expect(lerSeq(store)).toBe(0);
    saveData(store, emptyData());
    saveData(store, emptyData());
    expect(store.items.get(SEQ_KEY)).toBe('2');
    expect(espelhoMaisNovo(2, null)).toBe(false);
    expect(espelhoMaisNovo(2, { seq: 2, json: '{}' })).toBe(false); // empate: o localStorage chegou ao disco
    expect(espelhoMaisNovo(2, { seq: 3, json: '{}' })).toBe(true); // o último passo só está no espelho
  });

  it('cancelar turno: descarta cabeçalho, OSs e rascunho sem criar folha; a folha reaberta volta ao histórico no lugar dela', () => {
    const os = finishedOS('1', 'COMERCIAL', '28');
    const nova = { header, ordens: [os], fechadaEm: '2026-11-21T18:00:00.000Z', tecnicos: [], baixadaEm: '' };
    const velha = { ...nova, fechadaEm: '2026-11-19T18:00:00.000Z' };
    const meio = { ...nova, fechadaEm: '2026-11-20T18:00:00.000Z', baixadaEm: '2026-11-20T19:00:00.000Z' };
    const d: AppData = { ...emptyData(), header, ordens: [os], draft: startDraft('COMERCIAL'), sheets: [nova, meio, velha] };
    cancelarDados(d);
    expect(d).toMatchObject({ header: null, ordens: [], draft: null, sheets: [nova, meio, velha], reaberta: null });
    // "Editar" tira a do meio do histórico e a guarda; mesmo depois de fechar e abrir o app, cancelar a correção a
    // devolve como estava (com a marca de baixada), no lugar dela.
    reabrirDados(d, meio);
    expect(d.sheets).toEqual([nova, velha]);
    const store = memoryStore();
    saveData(store, d);
    const reaberto = loadData(store);
    expect(reaberto.reaberta).toEqual(meio);
    cancelarDados(reaberto);
    expect(reaberto).toMatchObject({ header: null, sheets: [nova, meio, velha], reaberta: null });
    // Os técnicos que o "Editar" pôs de volta no cadastro saem ao cancelar; os que já estavam ficam.
    const ana = { id: 'ana', nome: 'ANA', telefone: '1' };
    const beto = { id: 'beto', nome: 'BETO', telefone: '2' };
    const comTecnicos = { ...velha, tecnicos: [ana, beto] };
    const t: AppData = { ...emptyData(), sheets: [comTecnicos], tecnicos: [ana] };
    reabrirDados(t, comTecnicos);
    expect(t.tecnicos).toEqual([ana, beto]);
    expect(t.tecnicosDaReaberta).toEqual(['beto']);
    cancelarDados(t);
    expect(t).toMatchObject({ tecnicos: [ana], tecnicosDaReaberta: [], sheets: [comTecnicos] });
    // Encerrar a correção também esquece a original.
    reabrirDados(d, meio);
    encerrarDados(d, '2026-11-22T08:00:00.000Z');
    expect(d.reaberta).toBeNull();
  });

  it('até a 1.4.15 encerrar já baixava o PDF: folha antiga (sem baixadaEm) conta como baixada; a nova não', () => {
    const velha = { header, ordens: [], fechadaEm: '2026-11-19T20:00:00.000Z', tecnicos: [] };
    const nova = { ...velha, fechadaEm: '2026-11-20T20:00:00.000Z', baixadaEm: '' };
    const loaded = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), sheets: [nova, velha] }) }));
    expect(loaded.sheets.map((s) => s.baixadaEm)).toEqual(['', '2026-11-19T20:00:00.000Z']);
  });

  it('rótulo da folha e "mesma pessoa" (nome e matrícula, sem diferença de maiúsculas/espaços)', () => {
    expect(sheetLabel({ header, ordens: [], fechadaEm: 'x', tecnicos: [], baixadaEm: '' })).toBe('20/11/2026 • João da Silva • 0 OSs');
    expect(mesmaPessoa({ nome: ' ana ', matricula: '1' }, { nome: 'ANA', matricula: '1 ' })).toBe(true);
    expect(mesmaPessoa({ nome: 'ANA', matricula: '1' }, { nome: 'ANA', matricula: '2' })).toBe(false);
    expect(mesmaPessoa(null, { nome: 'ANA', matricula: '1' })).toBe(false);
  });

  it('armazenamento ilegível não é sobrescrito ao abrir', () => {
    const store = memoryStore({ [STORAGE_KEY]: '{quebrado' });
    expect(loadData(store)).toEqual(emptyData());
    expect(store.items.get(STORAGE_KEY)).toBe('{quebrado');
  });

  it('ocorrência salva na 1.4.1 (SIM/NÃO + número) ou 1.4.2 (só o número): vira o campo do número; NÃO fica em branco', () => {
    const base = { osNumber: '1', serviceType: 'OCORRENCIA', serviceCode: '508', registradaEm: 'x' };
    const sim = { ...base, id: 's', answers: { medidorInst: { kind: 'choice', choice: 'Sim', detail: ' N62123 ' } } };
    const nao = { ...base, id: 'n', answers: { medidorInst: { kind: 'choice', choice: 'Não' } } };
    const draft = { osNumber: '', serviceType: 'OCORRENCIA', serviceCode: '508', answers: { medidorInst: { kind: 'choice', choice: 'Sim', detail: 'W61' } } };
    const loaded = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [sim, nao], draft }) }));
    expect(loaded.ordens[0]?.answers.medidorInstNum).toEqual({ kind: 'text', value: 'N62123' });
    expect(loaded.ordens[1]?.answers.medidorInstNum).toEqual({ kind: 'skipped' });
    expect(loaded.draft?.answers.medidorInstNum).toEqual({ kind: 'text', value: 'W61' });
    for (const o of [...loaded.ordens, loaded.draft]) expect(o?.answers.medidorInst).toBeUndefined();
    // 1.4.2/1.4.3: só o número, em medidorInst.
    const soNumero = { ...base, id: 't', answers: { medidorInst: { kind: 'text', value: 'D60' } } };
    expect(loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [soNumero] }) })).ordens[0]?.answers).toEqual({ medidorInstNum: { kind: 'text', value: 'D60' } });
  });

  it('comercial até a 1.4.4 (instalado/retirado) → medidor da UC + novo medidor, com o mesmo Espelho de Campo', () => {
    const carrega = (answers: Record<string, unknown>) => {
      const os = { id: 'c', osNumber: '1', serviceType: 'COMERCIAL', serviceCode: '709', registradaEm: 'x', answers };
      return loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [os] }) })).ordens[0]!;
    };
    const t = (value: string) => ({ kind: 'text', value });
    const sim = { kind: 'choice', choice: 'Sim' };
    const nao = { kind: 'choice', choice: 'Não' };
    // 1.4.4, troca: instalou N1 e retirou R1 → UC = R1, novo = N1.
    const troca = carrega({ medidorInst: sim, medidorInstNum: t('N1'), leituraInst: t('10'), medidorRet: sim, medidorRetNum: t('R1'), leituraRet: t('20') });
    expect(troca.answers).toEqual({ medidorInstNum: t('R1'), leituraInst: t('20'), novoMedidor: sim, novoMedidorNum: t('N1'), novoLeitura: t('10') });
    expect(espelhoRows([troca])[0]).toMatchObject({ medidorInstalado: 'N1', leituraInstalado: '10', medidorRetirado: 'R1', leituraRetirado: '20' });
    // 1.4.4, os dois NÃO: medidor da UC.
    const uc = carrega({ medidorInst: nao, medidorRet: nao, medidorInstNum: t('UC'), leituraInst: t('5') });
    expect(uc.answers).toEqual({ medidorInstNum: t('UC'), leituraInst: t('5'), novoMedidor: nao });
    // ≤1.4.3: "Se sim qual número?" junto e leituras sem depender do SIM/NÃO (retirado NÃO com leitura = houve).
    const antiga = carrega({ medidorInst: { ...sim, detail: ' N62 ' }, medidorRet: nao, leituraInst: t('5'), leituraRet: t('777') });
    expect(espelhoRows([antiga])[0]).toMatchObject({ medidorInstalado: 'N62', leituraInstalado: '5', leituraRetirado: '777' });
    // Estável: carregar de novo não muda nada.
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [troca] }) });
    expect(loadData(store).ordens[0]).toEqual(troca);
  });

  it('eletricistas: sem cadastro (até a 1.4.4), começa com a dupla dos últimos cabeçalhos', () => {
    const h1 = { ...header, nome1: 'Ana', mat1: '1', nome2: 'Bia', mat2: '2' };
    const r = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), eletricistas: undefined, header: h1, lastHeader: { ...h1, nome2: '' } }) }));
    expect(r.eletricistas.map((e) => [e.nome, e.matricula])).toEqual([['ANA', '1'], ['BIA', '2']]);
    // Com cadastro salvo (mesmo vazio), não semeia de novo.
    expect(loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), header: h1 }) })).eletricistas).toEqual([]);
  });

  it('histórico de folhas: a última folha da versão anterior vira o 1º item; guarda no máximo 4', () => {
    const folha = (data: string) => ({ header: { ...header, data }, ordens: [], fechadaEm: data, tecnicos: [], baixadaEm: data });
    // Até a 1.4.4: só `lastSheet`.
    const antigo = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), sheets: undefined, lastSheet: folha('2026-11-20') }) }));
    expect(antigo.sheets.map((s) => s.header.data)).toEqual(['2026-11-20']);
    // Mais de 4 (ou folha sem cabeçalho válido): só as 4 mais recentes que dá para gerar o PDF.
    const varias = ['2026-11-21', '2026-11-20', '2026-11-19', '2026-11-18', '2026-11-17'].map(folha);
    const r = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), sheets: [{ header: null }, ...varias] }) }));
    expect(r.sheets.map((s) => s.header.data)).toEqual(['2026-11-21', '2026-11-20', '2026-11-19', '2026-11-18']);
    // Folha com OSs corrompidas: abre mesmo assim, sem as OSs inválidas.
    const quebrada = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), sheets: [{ ...folha('2026-11-21'), ordens: {} }, { ...folha('2026-11-20'), ordens: [null] }] }) }));
    expect(quebrada.sheets.map((s) => s.ordens.length)).toEqual([0, 0]);
    // Ao encerrar: a nova entra no topo e a 5ª (mais antiga) sai.
    expect(pushSheet(r.sheets, folha('2026-11-22')).map((s) => s.header.data)).toEqual(['2026-11-22', '2026-11-21', '2026-11-20', '2026-11-19']);
  });
});
