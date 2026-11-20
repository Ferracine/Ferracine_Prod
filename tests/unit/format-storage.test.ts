import { describe, expect, it } from 'vitest';
import { formatDateBR, formatHorario, osLabel, pdfFileName, teamLabel, todayISO } from '../../src/domain/format';
import type { AppData } from '../../src/domain/types';
import { STORAGE_KEY, emptyData, loadData, saveData, type KeyValueStore } from '../../src/storage';
import { baseHeader as header } from './fixtures';

function memoryStore(initial?: string): KeyValueStore & { value: string | null } {
  return {
    value: initial ?? null,
    getItem() { return this.value; },
    setItem(_k: string, v: string) { this.value = v; },
  };
}

describe('formatação', () => {
  it('converte datas sem depender do fuso', () => {
    expect(formatDateBR('2026-01-05')).toBe('05/01/2026');
    expect(formatDateBR('texto livre')).toBe('texto livre');
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('monta horário e equipe', () => {
    expect(formatHorario(header)).toBe('07:00 às 17:00');
    expect(teamLabel(header)).toBe('João da Silva (Mat: 123456)');
    expect(teamLabel({ ...header, nome2: 'Ana', mat2: '' })).toBe('João da Silva (Mat: 123456) • Ana (Mat: -)');
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
    expect(loadData(memoryStore('{quebrado'))).toEqual(emptyData());
    expect(loadData(memoryStore(JSON.stringify({ version: 1, ordens: [] })))).toEqual(emptyData());
    expect(loadData(memoryStore('null'))).toEqual(emptyData());
  });

  it('sobrevive a localStorage indisponível', () => {
    const broken: KeyValueStore = {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('QuotaExceededError'); },
    };
    expect(loadData(broken)).toEqual(emptyData());
    expect(saveData(broken, emptyData())).toBe(false);
  });

  it('salva e recarrega o turno com rascunho e última folha', () => {
    const store = memoryStore();
    const data: AppData = {
      version: 2,
      header: { ...header, equipe: 'PVH-01', viatura: 'ABC1D23', bodycam2: 'BC-9', lider: 'X' },
      ordens: [{ id: '1', osNumber: '10', serviceType: 'COMERCIAL', serviceCode: '28', answers: { c1: { kind: 'skipped' } }, registradaEm: '2026-11-20T10:00:00.000Z' }],
      draft: { osNumber: '', serviceType: 'OCORRENCIA', serviceCode: '508', index: 3, answers: {} },
      lastSheet: { header, ordens: [], fechadaEm: '2026-11-19T20:00:00.000Z' },
    };
    expect(saveData(store, data)).toBe(true);
    expect(store.value).toContain('"version":2');
    expect(loadData(store)).toEqual(data);
    expect(STORAGE_KEY).toBe('ferracine_prod:v2');
  });

  it('completa com vazio os campos novos de cabeçalhos salvos pela versão anterior', () => {
    const { equipe: _e, viatura: _v, bodycam2: _b, lider: _l, ...antigo } = header;
    const store = memoryStore(JSON.stringify({ version: 2, header: antigo, ordens: [], draft: null, lastSheet: { header: antigo, ordens: [], fechadaEm: 'x' } }));
    const loaded = loadData(store);
    expect(loaded.header).toEqual(header);
    expect(loaded.lastSheet?.header).toEqual(header);
  });
});
