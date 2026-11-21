import { describe, expect, it } from 'vitest';
import { espelhoRows } from '../../src/domain/espelho';
import { eletricistaLabel, formatDateBR, formatHorario, osLabel, pdfFileName, todayISO } from '../../src/domain/format';
import type { AppData } from '../../src/domain/types';
import { LEGACY_STORAGE_KEY, STORAGE_KEY, emptyData, loadData, saveData, type KeyValueStore } from '../../src/storage';
import { baseHeader as header } from './fixtures';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
  };
}

describe('formatação', () => {
  it('converte datas sem depender do fuso', () => {
    expect(formatDateBR('2026-01-05')).toBe('05/01/2026');
    expect(formatDateBR('texto livre')).toBe('texto livre');
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('monta horário e eletricista', () => {
    expect(formatHorario(header)).toBe('07:00 às 17:00');
    expect(eletricistaLabel('JOÃO', '123456')).toBe('JOÃO (Mat: 123456)');
    expect(eletricistaLabel('ANA', '')).toBe('ANA (Mat: -)');
  });

  it('mostra S/N para OS sem número', () => {
    expect(osLabel('')).toBe('S/N');
    expect(osLabel('123')).toBe('123');
  });

  it('nomeia o PDF com os nomes da equipe e a quantidade de serviços', () => {
    expect(pdfFileName(header, 1)).toBe('Joao_da_Silva_1_servico.pdf');
    expect(pdfFileName({ ...header, nome2: '  Ângelo  Souza ' }, 3)).toBe('Joao_da_Silva_Angelo_Souza_3_servicos.pdf');
    expect(pdfFileName({ ...header, nome1: '###' }, 0)).toBe('Equipe_0_servicos.pdf');
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
      lastSheet: { header, ordens: [], fechadaEm: '2026-11-19T20:00:00.000Z', tecnicos },
      lastHeader: header,
      tecnicos,
    };
    expect(saveData(store, data)).toBe(true);
    expect(store.items.get(STORAGE_KEY)).toContain('"version":3');
    expect(loadData(store)).toEqual(data);
  });

  it('migra a versão 2: respostas para os ids novos, líder vira técnico cadastrado e último cabeçalho', () => {
    const { equipe: _e, viatura: _v, bodycam2: _b, lider: _l, ...antigo } = header;
    const lider = 'TEC. BELTRANO SOUZA - 69 90000-0002';
    const v2 = {
      version: 2,
      header: { ...antigo, lider },
      ordens: [
        { id: 'a', osNumber: '7', serviceType: 'OCORRENCIA', serviceCode: '508', registradaEm: 'x', answers: { o1: { kind: 'text', value: 'Falta' }, o6: { kind: 'choice', choice: 'Sim' }, o12: { kind: 'choice', choice: 'Sim', detail: 'M-1' }, o13: { kind: 'choice', choice: 'Sim', detail: 'M-0' }, o14: { kind: 'text', value: '12345' }, o16: { kind: 'skipped' } } },
        { id: 'b', osNumber: '8', serviceType: 'COMERCIAL', serviceCode: '28', registradaEm: 'x', answers: { c2: { kind: 'choice', choice: 'Não' } } },
      ],
      draft: { osNumber: '9', serviceType: 'OCORRENCIA', serviceCode: '509', index: 14, answers: { o2: { kind: 'text', value: '9' } } },
      lastSheet: { header: { ...antigo, lider }, ordens: [], fechadaEm: 'y' },
    };
    const loaded = loadData(memoryStore({ [LEGACY_STORAGE_KEY]: JSON.stringify(v2) }));
    expect(loaded.version).toBe(3);
    expect(loaded.tecnicos).toEqual([{ id: 'tec-migrado-1', nome: 'TEC. BELTRANO SOUZA', telefone: '69 90000-0002' }]);
    expect(loaded.header).toEqual({ ...header, lider: 'tec-migrado-1' });
    expect(loaded.lastHeader).toEqual(loaded.header);
    expect(loaded.lastSheet?.tecnicos).toEqual(loaded.tecnicos);
    // Medidor instalado e leitura voltaram a ter pergunta na ocorrência; o medidor retirado (sem pergunta) fica
    // preservado para INFO ADICIONAL.
    expect(loaded.ordens[0]?.answers).toEqual({
      tipo: { kind: 'text', value: 'Falta' },
      ditais: { kind: 'choice', choice: 'Sim' },
      medidorInstNum: { kind: 'text', value: 'M-1' },
      leituraInst: { kind: 'text', value: '12345' },
    });
    expect(loaded.ordens[0]?.infoLegada).toBe('Medidor retirado: M-0');
    expect(loaded.ordens[1]?.answers).toEqual({ clientePresente: { kind: 'choice', choice: 'Não' } });
    expect(loaded.draft).toMatchObject({ answers: { os: { kind: 'text', value: '9' } } });
  });

  it('rascunho do antigo assistente: o número respondido na pergunta do número vai para o campo do topo', () => {
    const antigo = { ...emptyData(), draft: { osNumber: '', serviceType: 'OCORRENCIA', serviceCode: '508', index: 4, answers: { os: { kind: 'text', value: ' 123 ' } } } };
    expect(loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify(antigo) })).draft?.osNumber).toBe('123');
    const semResposta = { ...emptyData(), draft: { osNumber: '9', serviceType: 'COMERCIAL', serviceCode: '28', answers: {} } };
    expect(loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify(semResposta) })).draft?.osNumber).toBe('9');
  });

  it('OS de ocorrência migrada antes da 1.4.1: medidor instalado e leitura saem da INFO ADICIONAL para as perguntas', () => {
    const os = {
      id: 'm', osNumber: '7', serviceType: 'OCORRENCIA', serviceCode: '508', registradaEm: 'x',
      answers: { ditais: { kind: 'choice', choice: 'Sim' } },
      infoLegada: 'Medidor instalado: M-1; Medidor retirado: M-0; Leitura medidor instalado: 123; KM inicial (2º): 5; 6',
    };
    const salvo = { ...emptyData(), ordens: [os], lastSheet: { header, ordens: [os], fechadaEm: 'y', tecnicos: [] } };
    const loaded = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify(salvo) }));
    for (const o of [loaded.ordens[0], loaded.lastSheet?.ordens[0]]) {
      expect(o?.answers).toMatchObject({ medidorInstNum: { kind: 'text', value: 'M-1' }, leituraInst: { kind: 'text', value: '123' } });
      expect(o?.infoLegada).toBe('Medidor retirado: M-0; KM inicial (2º): 5; 6');
    }
    // Já respondida na pergunta nova: o texto antigo não sobrescreve.
    const respondida = { ...os, answers: { ...os.answers, medidorInstNum: { kind: 'text', value: 'M-9' } }, infoLegada: 'Medidor instalado: M-1' };
    const r = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [respondida] }) })).ordens[0];
    expect(r?.answers.medidorInstNum).toEqual({ kind: 'text', value: 'M-9' });
    expect(r?.infoLegada).toBe('Medidor instalado: M-1');
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

  it('comercial até a 1.4.3 com leitura e SIM/NÃO sem resposta: marca SIM para a leitura continuar valendo', () => {
    const os = {
      id: 'l', osNumber: '1', serviceType: 'COMERCIAL', serviceCode: '709', registradaEm: 'x',
      answers: { medidorInst: { kind: 'skipped' }, leituraInst: { kind: 'text', value: '12345' }, leituraRet: { kind: 'text', value: '777' } },
    };
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [os] }) });
    const o = loadData(store).ordens[0]!;
    expect(o.answers.medidorInst).toEqual({ kind: 'choice', choice: 'Sim' });
    expect(o.answers.medidorRet).toEqual({ kind: 'choice', choice: 'Sim' });
    // A leitura vai para o PDF (não fica escondida).
    expect(espelhoRows([o])[0]).toMatchObject({ leituraInstalado: '12345', leituraRetirado: '777' });
  });

  it('comercial até a 1.4.3 ("Foi instalado/retirado medidor? Se sim qual número?"): SIM/NÃO e número separados', () => {
    const os = {
      id: 'c', osNumber: '1', serviceType: 'COMERCIAL', serviceCode: '709', registradaEm: 'x',
      answers: { medidorInst: { kind: 'choice', choice: 'Sim', detail: ' N62 ' }, medidorRet: { kind: 'choice', choice: 'Não' }, leituraInst: { kind: 'text', value: '5' } },
    };
    const a = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [os] }) })).ordens[0]?.answers;
    expect(a).toEqual({
      medidorInst: { kind: 'choice', choice: 'Sim' },
      medidorInstNum: { kind: 'text', value: 'N62' },
      medidorRet: { kind: 'choice', choice: 'Não' },
      leituraInst: { kind: 'text', value: '5' },
    });
  });

  it('medidor da 1.4.1 com NÃO e texto legado: o número legado vai para o campo já no primeiro carregamento', () => {
    const os = { id: 'x', osNumber: '1', serviceType: 'OCORRENCIA', serviceCode: '508', registradaEm: 'x', answers: { medidorInst: { kind: 'choice', choice: 'Não' } }, infoLegada: 'Medidor instalado: M-1; Medidor retirado: Sim' };
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [os] }) });
    const primeiro = loadData(store);
    expect(primeiro.ordens[0]?.answers.medidorInstNum).toEqual({ kind: 'text', value: 'M-1' });
    saveData(store, primeiro);
    expect(loadData(store).ordens[0]).toEqual(primeiro.ordens[0]); // estável
    // "Medidor instalado: Sim" sem número: descartado.
    const soSim = { ...os, answers: {}, infoLegada: 'Medidor instalado: Sim' };
    const r = loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), ordens: [soSim] }) })).ordens[0];
    expect(r?.infoLegada).toBeUndefined();
    expect(r?.answers.medidorInstNum).toBeUndefined();
  });

  it('a versão 3 salva tem prioridade; se estiver corrompida, a versão 2 antiga não volta', () => {
    const atual = { ...emptyData(), lastHeader: header };
    const v2 = JSON.stringify({ version: 2, ordens: [{ id: 'z', serviceType: 'COMERCIAL', answers: {} }] });
    expect(loadData(memoryStore({ [STORAGE_KEY]: JSON.stringify(atual), [LEGACY_STORAGE_KEY]: v2 }))).toEqual(atual);
    expect(loadData(memoryStore({ [STORAGE_KEY]: '{quebrado', [LEGACY_STORAGE_KEY]: v2 }))).toEqual(emptyData());
  });

  it('migração descarta o rascunho de EDIÇÃO da v2 (a OS original continua; nada é duplicado)', () => {
    const v2 = {
      version: 2,
      header: null,
      ordens: [{ id: 'a', osNumber: '1', serviceType: 'COMERCIAL', serviceCode: '28', registradaEm: 'x', answers: {} }],
      draft: { osNumber: '1', serviceType: 'COMERCIAL', serviceCode: '28', index: 2, answers: {}, editingId: 'a' },
      lastSheet: null,
    };
    const loaded = loadData(memoryStore({ [LEGACY_STORAGE_KEY]: JSON.stringify(v2) }));
    expect(loaded.draft).toBeNull();
    expect(loaded.ordens).toHaveLength(1);
  });
});
