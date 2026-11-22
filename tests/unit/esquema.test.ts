import { describe, expect, it } from 'vitest';
import { INVALIDO, montar, type Esquema } from '../../src/storage';

interface Exemplo {
  id: string;
  nome: string;
  apelido?: string;
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const ESQUEMA: Esquema<Exemplo> = {
  id: (v) => (typeof v === 'string' && v ? v : INVALIDO),
  nome: texto,
  apelido: (v) => (typeof v === 'string' ? v : undefined),
};

describe('esquema dos dados salvos (montar)', () => {
  it('monta só com os campos do esquema: campo de versão antiga fica para trás; texto ausente vira vazio', () => {
    expect(montar(ESQUEMA, { id: 'a', nome: 'ANA', index: 4, infoLegada: 'velho' })).toEqual({ id: 'a', nome: 'ANA' });
    expect(montar(ESQUEMA, { id: 'a' })).toEqual({ id: 'a', nome: '' });
  });

  it('campo opcional: entra quando existe; lido como undefined, fica de fora (não vira chave vazia)', () => {
    expect(montar(ESQUEMA, { id: 'a', nome: 'ANA', apelido: 'NA' })).toEqual({ id: 'a', nome: 'ANA', apelido: 'NA' });
    expect(Object.keys(montar(ESQUEMA, { id: 'a', nome: 'ANA' })!)).toEqual(['id', 'nome']);
  });

  it('campo inválido descarta o item inteiro; o que não é objeto também', () => {
    expect(montar(ESQUEMA, { id: '', nome: 'ANA' })).toBeUndefined();
    for (const raw of [null, undefined, 'x', 3]) expect(montar(ESQUEMA, raw)).toBeUndefined();
  });

  it('o esquema cobre todos os campos do tipo (checado pelo tsc em `pnpm lint`)', () => {
    // @ts-expect-error campo opcional sem leitor: não compila (seria apagado calado na primeira abertura)
    const semOpcional: Esquema<Exemplo> = { id: ESQUEMA.id, nome: texto };
    // @ts-expect-error campo obrigatório sem leitor: não compila
    const semObrigatorio: Esquema<Exemplo> = { id: ESQUEMA.id, apelido: ESQUEMA.apelido };
    // @ts-expect-error leitor a mais, de campo que não existe no tipo: não compila
    const aMais: Esquema<Exemplo> = { ...ESQUEMA, sobra: texto };
    expect([semOpcional, semObrigatorio, aMais]).toHaveLength(3);
  });
});
