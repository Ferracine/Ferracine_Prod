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
  append(el, children);
  return el;
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
  warning: 'bg-amber-500/10 border border-amber-400/30 p-3 rounded-xl text-xs text-amber-200 font-medium',
  danger: 'bg-rose-500/10 border border-rose-400/30 p-3 rounded-xl text-xs text-rose-200 font-medium',
} as const;

export const BTN = {
  primary: 'px-5 py-2.5 bg-energisa-blue hover:brightness-110 text-white font-bold rounded-xl text-sm',
  neutral: 'px-4 py-2.5 bg-white/10 hover:bg-white/15 text-slate-100 font-bold rounded-xl text-sm',
  danger: 'px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm',
  accent: 'px-5 py-2.5 bg-energisa-orange hover:brightness-110 text-white font-extrabold rounded-xl text-sm flex items-center gap-2',
} as const;

/** Botão grande de ação principal (gradiente azul do layout). */
export const BTN_PRIMARY_LG =
  'bg-gradient-to-r from-energisa-blue to-sky-500 hover:brightness-110 text-white font-extrabold py-4 px-6 rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 text-base active:scale-[0.99]';
