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

export const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-energisa-blue focus:ring-2 focus:ring-energisa-blue/20 outline-none text-base font-medium bg-white';

export const LABEL_CLS = 'block text-xs font-bold text-slate-700 uppercase mb-1';

export const BTN = {
  primary: 'px-5 py-2.5 bg-energisa-blue hover:bg-energisa-navy text-white font-bold rounded-xl text-sm',
  neutral: 'px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-sm',
  danger: 'px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm',
  accent: 'px-5 py-2.5 bg-energisa-orange hover:bg-orange-600 text-white font-extrabold rounded-xl text-sm flex items-center gap-2',
} as const;
