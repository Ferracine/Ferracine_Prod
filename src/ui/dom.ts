import { createElement, type IconNode } from 'lucide';

type Child = Node | string | number | null | undefined | false;
type Children = Child | Child[];
type Handler = (ev: Event) => void;
type Props = Record<string, string | number | boolean | Handler | null | undefined>;

/**
 * Cria um elemento com atributos, eventos (`onClick`, `onInput`...) e filhos.
 * Texto entra sempre como nó de texto: dados do usuário nunca são interpretados como HTML.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Children[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      el.className = String(value);
    } else if (key === 'value') {
      (el as HTMLInputElement).value = String(value);
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  // Campos de texto sempre em maiúsculas: o teclado do celular abre com o caps lock (o texto é convertido por
  // forceUppercase, mesmo que o teclado ignore o pedido).
  if (isTextField(el)) el.setAttribute('autocapitalize', 'characters');
  append(el, children);
  return el;
}

/** Campo onde se digita texto (data, hora, caixa de seleção etc. ficam de fora). */
function isTextField(el: unknown): el is HTMLInputElement | HTMLTextAreaElement {
  return (el instanceof HTMLInputElement && el.type === 'text') || el instanceof HTMLTextAreaElement;
}

/**
 * Tudo o que é digitado nos campos de texto vira maiúsculas (nomes, equipe, respostas...), mantendo o cursor no lugar.
 * Escuta na captura: corre antes do onInput do campo, que já recebe o texto convertido.
 */
export function forceUppercase(root: Document = document): void {
  const upper = (el: EventTarget | null) => {
    if (!isTextField(el) || el.value === el.value.toUpperCase()) return;
    const { selectionStart, selectionEnd } = el;
    const antes = el.value.length;
    el.value = el.value.toUpperCase();
    const d = el.value.length - antes; // "ß" vira "SS": o cursor anda junto
    el.setSelectionRange((selectionStart ?? 0) + d, (selectionEnd ?? 0) + d);
  };
  // Trocar o valor no meio da composição (sugestões do teclado do Android) duplica letras: espera a palavra fechar.
  root.addEventListener('input', (ev) => !(ev as InputEvent).isComposing && upper(ev.target), true);
  root.addEventListener('compositionend', (ev) => {
    upper(ev.target);
    ev.target?.dispatchEvent(new Event('input', { bubbles: true })); // o campo grava o texto já convertido
  }, true);
}

function append(el: Element, children: Children[]): void {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'object' ? child : String(child));
  }
}

export function icon(node: IconNode, cls = 'w-4 h-4'): SVGElement {
  return createElement(node, { class: cls, 'aria-hidden': 'true' });
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado`);
  return el as T;
}

/**
 * Campo que falta preencher: fica com a borda vermelha (`.faltando`, styles.css) até a pessoa mexer nele (digitar,
 * escolher ou tocar). Serve para campo (`.field`) e para o cartão de uma pergunta (`.card`).
 */
export function marcarFaltando(el: Element | null | undefined): void {
  if (!el || el.classList.contains('faltando')) return;
  el.classList.add('faltando');
  // Campo: só sai do vermelho quando muda de valor (abrir o relógio ou a lista e cancelar não conta). Cartão de
  // pergunta: também ao tocar em SIM/NÃO dentro dele.
  const eventos = el.matches('.card') ? ['input', 'change', 'click'] : ['input', 'change'];
  const limpa = () => {
    el.classList.remove('faltando');
    for (const ev of eventos) el.removeEventListener(ev, limpa);
  };
  for (const ev of eventos) el.addEventListener(ev, limpa);
}

/** Handler de `onKeydown` que executa `action` ao apertar Enter (tecla "Próximo"/"OK" do teclado do celular). */
export function onEnter(action: () => void): Handler {
  return (ev) => {
    if ((ev as KeyboardEvent).key !== 'Enter') return;
    ev.preventDefault();
    action();
  };
}

/** Caixa de aviso dentro de janelas. */
export const CALLOUT = {
  warning: 'bg-accent/10 border border-accent/30 p-3 rounded-xl text-xs text-accent-fg font-medium',
  danger: 'bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-xs text-danger-fg font-medium',
} as const;

/**
 * Padrão dos botões: mesmo raio (rounded-xl), mesmo espaçamento em todas as cores e área de toque mínima de 44 px
 * (luva, sol, celular numa mão só). A cor diz o papel: ciano do logo = ação principal, laranja = encerrar,
 * vermelho = excluir/descartar, cinza = o resto.
 */
// `btn` e `btn-<tom>`: ganchos dos temas retrô (styles.css), que troca o acabamento sem mudar as telas.
const BTN_BASE = 'btn inline-flex items-center justify-center gap-2 rounded-xl leading-tight text-center transition-colors active:scale-[0.98] disabled:opacity-60';
const BTN_TAMANHO = {
  lg: 'min-h-14 px-6 py-3 text-base font-extrabold', // 56 px: ação principal da tela (ícone w-5)
  md: 'min-h-12 px-4 py-2 text-sm font-bold', // 48 px: janelas, histórico, Cancelar, Atualizar
  sm: 'min-h-11 px-3 py-1.5 text-xs font-bold', // 44 px: ação pequena dentro de um cartão
  icon: 'size-11 shrink-0', // 44 x 44, só ícone (ícone w-5)
} as const;
/** Botão sem moldura (só o texto/ícone; fundo ao passar o dedo). */
const SEM_MOLDURA = 'text-muted hover:bg-fg/10 hover:text-fg';
const BTN_TOM = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white',
  neutral: 'bg-fg/10 hover:bg-fg/15 text-fg',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white',
  accent: 'bg-accent-600 hover:bg-accent-700 text-white',
  outline: 'bg-fg/5 border border-fg/10 hover:bg-fg/10', // cor do texto/ícone fica com quem usa
  /** Destrutiva, mas discreta (Cancelar turno, Excluir, lixeira): contornada, texto vermelho; confirma antes. */
  perigo: 'bg-fg/5 border border-fg/10 hover:bg-rose-500/10 text-danger-fg',
  ghost: SEM_MOLDURA,
  /** X das janelas: igual ao ghost, com gancho próprio (`btn-fechar`) para os temas Windows o desenharem como botão da barra de título. */
  fechar: SEM_MOLDURA,
} as const;
export type BtnTom = keyof typeof BTN_TOM;
/** Tons das ações de uma janela (os sem moldura não servem de ação). */
export type TomAcao = 'primary' | 'neutral' | 'danger' | 'accent';

export function btn(tom: BtnTom, tamanho: keyof typeof BTN_TAMANHO = 'md'): string {
  return `${BTN_BASE} btn-${tom} ${BTN_TAMANHO[tamanho]} ${BTN_TOM[tom]}`;
}

/** Botão grande de ação principal (Iniciar turno, Salvar OS). */
export const BTN_PRIMARY_LG = `${btn('primary', 'lg')} shadow-lg shadow-brand/20`;

/** Link de ação ("Adicionar / excluir ...", "Procurar atualização"): texto pequeno, mas com 44 px de toque. */
export const BTN_LINK = 'inline-flex items-center gap-1.5 min-h-11 text-xs font-bold text-brand-fg hover:underline whitespace-nowrap';

/** Cores de BTN_CHOICE marcada e desmarcada (a desmarcada vale também para BTN_OPCAO). */
export const ESCOLHA_ON = 'border-brand bg-brand-600 text-white';
export const ESCOLHA_OFF = 'border-fg/15 bg-fg/5 text-fg';

/** Escolha entre opções (SIM/NÃO, Solo/Dupla): cor de fundo e borda vêm de quem usa, conforme o estado. */
export const BTN_CHOICE = 'escolha flex items-center justify-center gap-2 rounded-xl border-2 font-extrabold transition-all';

/** Item de uma lista de opções numa janela (ex.: a lista de temas): `aria-pressed` marca o escolhido (OPCAO_ON). */
export const BTN_OPCAO = 'opcao flex items-center gap-3 rounded-xl border-2 transition-all';
export const OPCAO_ON = 'border-brand bg-brand/10 text-fg';

let retomarToques: ReturnType<typeof setTimeout> | undefined;

/** Pausa os toques na página por 400 ms: o 2º toque de um toque duplo cairia na tela ou janela que acabou de aparecer. */
export function pausarToques(): void {
  clearTimeout(retomarToques);
  document.body.style.pointerEvents = 'none';
  retomarToques = setTimeout(() => (document.body.style.pointerEvents = ''), 400);
}

/** Botão do topo (histórico, tema...) no lugar reservado no index.html: o `<span>` com o id já guarda o espaço. */
export function botaoDoTopo(slot: HTMLElement, node: IconNode, rotulo: string, onClick: () => void): HTMLButtonElement {
  const button = h('button', { type: 'button', id: slot.id, class: `${btn('outline', 'icon')} text-fg`, 'aria-label': rotulo, title: rotulo, onClick }, icon(node, 'w-5 h-5'));
  slot.replaceWith(button);
  return button;
}

/** Botões lado a lado em colunas iguais; o que sobra numa linha (quantidade ímpar) ou é largo ocupa a linha toda. */
export function gradeBotoes(botoes: HTMLElement[], largos: ReadonlySet<HTMLElement> = new Set()): HTMLElement {
  const meios = botoes.filter((b) => !largos.has(b));
  for (const b of botoes) {
    b.classList.add('w-full');
    if (largos.has(b) || (meios.length % 2 === 1 && b === meios.at(-1))) b.classList.add('col-span-2');
  }
  return h('div', { class: 'grid grid-cols-2 gap-3' }, botoes);
}
