import { Download, ExternalLink, Pencil, Share2, Trash2, type IconNode } from 'lucide';
import { sheetLabel } from '../domain/format';
import type { ClosedSheet } from '../domain/types';
import { btn, type BtnTom, gradeBotoes, h, icon } from './dom';

/** O que dá para fazer com uma folha encerrada do histórico. */
export type AcaoFolha = 'download' | 'open' | 'share' | 'edit' | 'delete';

export interface FolhasProps {
  /** Últimas folhas encerradas (a mais recente primeiro). */
  sheets: readonly ClosedSheet[];
  canShare: boolean;
  /** Com um turno aberto, "Editar" (reabrir a folha como turno) fica desativado. */
  turnoAberto: boolean;
  onAcao: (sheet: ClosedSheet, acao: AcaoFolha) => void;
}

/**
 * Lista das últimas folhas, cada uma com Baixar, Abrir, Compartilhar, Editar e Excluir (grade de colunas iguais;
 * Excluir ocupa a linha). Usada no cartão da tela do cabeçalho e na janela do botão de histórico do topo.
 */
export function listaFolhas(p: FolhasProps): HTMLElement {
  if (!p.sheets.length) return h('p', { class: 'text-sm text-muted' }, 'Nenhuma folha encerrada ainda. Elas aparecem aqui ao encerrar o turno.');
  const botao = (sheet: ClosedSheet, acao: AcaoFolha, tom: BtnTom, node: IconNode, texto: string, extra: Record<string, string | boolean> = {}) =>
    h('button', { type: 'button', class: btn(tom), onClick: () => p.onAcao(sheet, acao), ...extra }, icon(node), texto);
  return h(
    'div',
    { class: 'space-y-3', 'data-lista': 'folhas' },
    p.sheets.map((sheet) => {
      // Destrutiva, mas discreta (contornada, texto vermelho): o destaque fica com "Baixar PDF"; confirma antes.
      const excluir = botao(sheet, 'delete', 'outline', Trash2, 'Excluir');
      excluir.classList.add('text-danger-fg');
      return h(
        'div',
        { class: 'space-y-2 border-t border-fg/10 pt-3 first:border-t-0 first:pt-0', 'data-testid': 'last-sheet' },
        h(
          'p',
          { class: 'text-xs text-muted min-w-0 flex flex-wrap items-center gap-2' },
          sheetLabel(sheet),
          !sheet.baixadaEm && h('span', { class: 'text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-danger-fg' }, 'PDF não baixado'),
        ),
        gradeBotoes(
          [
            botao(sheet, 'download', 'primary', Download, 'Baixar PDF'),
            botao(sheet, 'open', 'neutral', ExternalLink, 'Abrir PDF'),
            ...(p.canShare ? [botao(sheet, 'share', 'neutral', Share2, 'Compartilhar')] : []),
            botao(sheet, 'edit', 'neutral', Pencil, 'Editar', p.turnoAberto ? { disabled: true, title: 'Encerre o turno aberto para editar esta folha' } : {}),
            excluir,
          ],
          new Set([excluir]),
        ),
      );
    }),
    p.turnoAberto && h('p', { class: 'text-xs text-muted' }, 'Para editar uma folha encerrada, encerre antes o turno aberto.'),
  );
}
