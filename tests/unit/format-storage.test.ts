import { describe, expect, it } from 'vitest';
import { espelhoRows } from '../../src/domain/espelho';
import { formatDateBR, formatHorario, mesmaPessoa, osLabel, sheetFileName, sheetLabel, todayISO } from '../../src/domain/format';
import type { AppData } from '../../src/domain/types';
import { emptyData, encerrarDados, type KeyValueStore, loadData, pushSheet, reabrirDados, removerFolha, saveData, STORAGE_KEY } from '../../src/storage';
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
      sheets: [{ header, ordens: [], fechadaEm: '2026-11-19T20:00:00.000Z', tecnicos }],
      eletricistas: [{ id: 'e1', nome: 'ANA', matricula: '1' }],
      lastHeader: header,
      tecnicos,
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
      sheets: [{ header, ordens: [os], fechadaEm: '2026-11-19T20:00:00.000Z', tecnicos: [{ id: 't', nome: 'TEC', telefone: '1' }] }],
      lastHeader: header,
      eletricistas: [{ id: 'e', nome: 'ANA', matricula: '1' }],
    };
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

  it('encerrar → editar (reabrir) → encerrar de novo: a folha volta ao turno e depois ao topo do histórico', () => {
    const os = finishedOS('1', 'COMERCIAL', '28', {}, 'o1');
    const antiga = { header: { ...header, nome1: 'VELHA' }, ordens: [], fechadaEm: 'x', tecnicos: [] };
    const d: AppData = { ...emptyData(), header, ordens: [os], sheets: [antiga] };
    const folha = { header, ordens: d.ordens, fechadaEm: '2026-11-20T18:00:00.000Z', tecnicos: [] };
    encerrarDados(d, folha);
    expect(d).toMatchObject({ header: null, ordens: [], draft: null, sheets: [folha, antiga] });
    reabrirDados(d, folha);
    expect(d).toMatchObject({ header, ordens: [os], draft: null, sheets: [antiga] });
    const corrigida = { ...folha, fechadaEm: '2026-11-21T08:00:00.000Z' };
    encerrarDados(d, corrigida);
    expect(d.sheets).toEqual([corrigida, antiga]);
    expect(removerFolha(d.sheets, antiga)).toEqual([corrigida]);
  });

  it('rótulo da folha e "mesma pessoa" (nome e matrícula, sem diferença de maiúsculas/espaços)', () => {
    expect(sheetLabel({ header, ordens: [], fechadaEm: 'x', tecnicos: [] })).toBe('20/11/2026 • João da Silva • 0 OSs');
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
    const folha = (data: string) => ({ header: { ...header, data }, ordens: [], fechadaEm: data, tecnicos: [] });
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
