import { Monitor, Moon, Smartphone, Sun } from 'lucide';
import { androidBridge } from './platform';
import { btn, h, icon } from './ui/dom';

/**
 * Aparência em dois eixos, cada um num atributo do <html> e salvo no aparelho:
 * - estilo (`data-estilo`): Tema 1 "Moderno" (padrão) ou Tema 2 "Retrô 98";
 * - variante (`data-theme`): claro ou escuro (sem escolha salva, segue o celular).
 * O script no <head> do index.html aplica os dois antes da primeira pintura (mesmas chaves e regras); aqui ficam os
 * botões do topo e o acompanhamento do tema do celular. As cores de cada combinação estão em styles.css.
 */

type Theme = 'light' | 'dark';
type Estilo = 'moderno' | 'retro';

const KEY = 'ferracine_prod:theme';
const ESTILO_KEY = 'ferracine_prod:estilo';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

const ESTILOS: Record<Estilo, { nome: string; icone: typeof Monitor }> = {
  moderno: { nome: 'Tema 1: Moderno', icone: Smartphone },
  retro: { nome: 'Tema 2: Retrô 98', icone: Monitor },
};

function guardar(key: string, valor: string): void {
  try {
    localStorage.setItem(key, valor);
  } catch {
    // sem armazenamento: vale só até fechar o app
  }
}

function saved(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

/** Barras do sistema (e a cor do navegador) com o fundo da combinação atual (variável --app de styles.css). */
function pintarBarras(): void {
  const root = document.documentElement;
  const bar = getComputedStyle(root).getPropertyValue('--app').trim();
  if (!bar) return;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar);
  androidBridge?.setSystemBars(bar, root.dataset.theme === 'dark'); // no APK, as barras do Android seguem o tema
}

function applyTheme(theme: Theme, button: HTMLButtonElement): void {
  document.documentElement.dataset.theme = theme;
  pintarBarras();
  const next = theme === 'dark' ? 'claro' : 'escuro';
  button.setAttribute('aria-label', `Usar tema ${next}`);
  button.title = `Tema ${next}`;
  button.replaceChildren(icon(theme === 'dark' ? Sun : Moon, 'w-5 h-5'));
}

function applyEstilo(estilo: Estilo, button: HTMLButtonElement): void {
  document.documentElement.dataset.estilo = estilo;
  pintarBarras();
  const outro = ESTILOS[estilo === 'retro' ? 'moderno' : 'retro'];
  button.setAttribute('aria-label', `Usar ${outro.nome}`);
  button.title = outro.nome;
  button.replaceChildren(icon(outro.icone, 'w-5 h-5'));
}

/** Monta um botão do topo no lugar reservado no index.html (o `<span>` já guarda o espaço dele). */
function botaoNoLugar(slot: HTMLElement): HTMLButtonElement {
  const button = h('button', { type: 'button', id: slot.id, class: `${btn('outline', 'icon')} text-fg` });
  slot.replaceWith(button);
  return button;
}

/** Botões do topo: estilo (Moderno ↔ Retrô 98) e claro ↔ escuro. */
export function initTheme(slotTema: HTMLElement, slotEstilo: HTMLElement): void {
  const botaoEstilo = botaoNoLugar(slotEstilo);
  applyEstilo(document.documentElement.dataset.estilo === 'retro' ? 'retro' : 'moderno', botaoEstilo);
  botaoEstilo.addEventListener('click', () => {
    const estilo: Estilo = document.documentElement.dataset.estilo === 'retro' ? 'moderno' : 'retro';
    guardar(ESTILO_KEY, estilo);
    applyEstilo(estilo, botaoEstilo);
  });

  const botaoTema = botaoNoLugar(slotTema);
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', botaoTema);
  botaoTema.addEventListener('click', () => {
    const theme: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    guardar(KEY, theme);
    applyTheme(theme, botaoTema);
  });

  // Sem escolha salva, acompanha o tema do celular.
  systemDark.addEventListener('change', () => {
    if (!saved()) applyTheme(systemDark.matches ? 'dark' : 'light', botaoTema);
  });
}
