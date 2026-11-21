import type { Answer, OrdemServico, ServiceType, ShiftHeader } from '../../src/domain/types';
import { finalize, startDraft } from '../../src/domain/ordem';

/** Cabeçalho mínimo válido; os testes sobrescrevem só o que importa. */
export const baseHeader: ShiftHeader = {
  nome1: 'João da Silva',
  mat1: '123456',
  nome2: '',
  mat2: '',
  equipe: '',
  viatura: '',
  data: '2026-11-20',
  horaInicio: '07:00',
  horaFim: '17:00',
  bodycam1: '',
  bodycam2: '',
  lider: '',
};

/** OS concluída como se a tela da OS tivesse sido preenchida com o número e `answers`. */
export function finishedOS(osNumber: string, type: ServiceType, code: string, answers: Record<string, Answer> = {}, id = 'x'): OrdemServico {
  return finalize({ ...startDraft(type), osNumber, serviceCode: code, answers }, id, new Date());
}
