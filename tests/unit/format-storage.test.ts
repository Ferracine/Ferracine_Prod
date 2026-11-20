import { describe, expect, it } from 'vitest';
import { countByType, formatDateBR, formatHorario, pdfFileName, teamLabel, todayISO } from '../../src/domain/format';
import type { AppData, ShiftHeader } from '../../src/domain/types';
import { STORAGE_KEY, emptyData, loadData, saveData, type KeyValueStore } from '../../src/storage';

const header: ShiftHeader = {
  nome1: 'João da Silva',
  mat1: '123456',
  nome2: '',
  mat2: '',
  data: '2026-11-20',
  horaInicio: '07:00',
  horaFim: '17:00',
  bodycam1: '',
};

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

  it('gera nome de arquivo sem acentos nem caracteres inválidos', () => {
    expect(pdfFileName(header)).toBe('Folha_Producao_Energisa_Joao_20-11-2026.pdf');
    expect(pdfFileName({ ...header, nome1: '  Ângelo  Souza' })).toBe('Folha_Producao_Energisa_Angelo_20-11-2026.pdf');
    expect(pdfFileName({ ...header, nome1: '###' })).toBe('Folha_Producao_Energisa_Equipe_20-11-2026.pdf');
  });

  it('conta OSs por tipo', () => {
    const os = (serviceType: 'COMERCIAL' | 'OCORRENCIA') => ({ id: '', osNumber: '', serviceType, serviceCode: '', answers: {}, registradaEm: '' });
    expect(countByType([os('COMERCIAL'), os('OCORRENCIA'), os('OCORRENCIA')])).toEqual({ comercial: 1, ocorrencia: 2 });
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
      header,
      ordens: [{ id: '1', osNumber: '10', serviceType: 'COMERCIAL', serviceCode: '28', answers: { c1: { kind: 'skipped' } }, registradaEm: '2026-11-20T10:00:00.000Z' }],
      draft: { osNumber: '11', serviceType: 'OCORRENCIA', serviceCode: '508', index: 3, answers: {} },
      lastSheet: { header, ordens: [], fechadaEm: '2026-11-19T20:00:00.000Z' },
    };
    expect(saveData(store, data)).toBe(true);
    expect(store.value).toContain('"version":2');
    expect(loadData(store)).toEqual(data);
    expect(STORAGE_KEY).toBe('ferracine_prod:v2');
  });
});
