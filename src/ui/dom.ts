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

/** Botões: ciano do logo para ações principais, laranja do logo para encerrar/gerar. */
export const BTN = {
  primary: 'px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm',
  neutral: 'px-4 py-2.5 bg-fg/10 hover:bg-fg/15 text-fg font-bold rounded-xl text-sm',
  danger: 'px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm',
  accent: 'px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white font-extrabold rounded-xl text-sm flex items-center gap-2',
} as const;

/** Botão grande de ação principal. */
export const BTN_PRIMARY_LG =
  'bg-brand-600 hover:bg-brand-700 text-white font-extrabold py-4 px-6 rounded-xl shadow-lg shadow-brand/20 transition-all flex items-center justify-center gap-2 text-base active:scale-[0.99]';
