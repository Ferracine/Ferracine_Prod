import { Check, Moon, Palette, Sun } from 'lucide';
import { androidBridge } from './platform';
import { btn, BTN_CHOICE, ESCOLHA_OFF, h, icon } from './ui/dom';
import { closeModal, openModal } from './ui/feedback';

/**
 * Aparência em dois eixos, cada um num atributo do <html> e salvo no aparelho:
 * - estilo (`data-estilo`): Tema 1 "Moderno" (padrão), Tema 2 "Retrô 98" ou Tema 3 "Windows 3.1";
 * - variante (`data-theme`): claro ou escuro (sem escolha salva, segue o celular).
 * O script no <head> do index.html aplica os dois antes da primeira pintura (mesmas chaves e regras); aqui ficam os
 * botões do topo (lista de temas e claro/escuro) e o acompanhamento do tema do celular. Cores em styles.css.
 */

type Theme = 'light' | 'dark';

/** Temas, na ordem da lista. O id é o valor de `data-estilo` (cores em styles.css). */
const ESTILOS = [
  { id: 'moderno', nome: 'Tema 1: Moderno', descricao: 'Cantos arredondados, cores do logo Energisa.' },
  { id: 'retro', nome: 'Tema 2: Retrô 98', descricao: 'Janelas cinza em relevo, barra de título em degradê.' },
  { id: 'win31', nome: 'Tema 3: Windows 3.1', descricao: 'Janelas brancas com moldura preta, barra de título sólida.' },
] as const;
type Estilo = (typeof ESTILOS)[number]['id'];

const KEY = 'ferracine_prod:theme';
const ESTILO_KEY = 'ferracine_prod:estilo';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

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

const estiloAtual = (): Estilo => ESTILOS.find((e) => e.id === document.documentElement.dataset.estilo)?.id ?? 'moderno';

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

function applyEstilo(estilo: Estilo): void {
  document.documentElement.dataset.estilo = estilo;
  pintarBarras();
}

/** Janela com a lista dos temas; tocar num deles aplica, guarda e fecha. */
function escolherEstilo(): void {
  const atual = estiloAtual();
  const opcoes = ESTILOS.map((e) =>
    h(
      'button',
      {
        type: 'button',
        'data-estilo-opcao': e.id,
        'aria-pressed': String(e.id === atual),
        class: `${BTN_CHOICE} w-full justify-start text-left gap-3 p-3 min-h-16 ${e.id === atual ? 'border-brand bg-brand/10 text-fg' : ESCOLHA_OFF}`,
        onClick: () => {
          guardar(ESTILO_KEY, e.id);
          applyEstilo(e.id);
          closeModal();
        },
      },
      // Miniatura com as cores do próprio tema (styles.css: `.amostra`), na variante clara/escura em uso.
      h(
        'span',
        { 'data-estilo': e.id, 'data-theme': document.documentElement.dataset.theme ?? 'light', class: 'amostra shrink-0 w-14 h-11 border border-fg/20 p-1.5', 'aria-hidden': 'true' },
        h('span', { class: 'amostra-janela block w-full h-full border border-black/40' }, h('span', { class: 'amostra-titulo block h-2' })),
      ),
      h('span', { class: 'flex-1 min-w-0' }, h('span', { class: 'block text-sm font-extrabold' }, e.nome), h('span', { class: 'block text-xs font-medium text-muted' }, e.descricao)),
      e.id === atual && icon(Check, 'w-5 h-5 shrink-0 text-brand-fg'),
    ),
  );
  openModal('Escolha o tema', h('div', { class: 'space-y-2' }, opcoes, h('p', { class: 'text-xs text-muted pt-1' }, 'Claro ou escuro: botão do sol/lua, ao lado. O PDF não muda com o tema.')), [
    { label: 'Fechar', variant: 'neutral', onClick: closeModal },
  ]);
}

/** Monta um botão do topo no lugar reservado no index.html (o `<span>` já guarda o espaço dele). */
function botaoNoLugar(slot: HTMLElement): HTMLButtonElement {
  const button = h('button', { type: 'button', id: slot.id, class: `${btn('outline', 'icon')} text-fg` });
  slot.replaceWith(button);
  return button;
}

/** Botões do topo: lista de temas e claro ↔ escuro. */
export function initTheme(slotTema: HTMLElement, slotEstilo: HTMLElement): void {
  const botaoEstilo = botaoNoLugar(slotEstilo);
  botaoEstilo.setAttribute('aria-label', 'Escolher o tema');
  botaoEstilo.title = 'Escolher o tema';
  botaoEstilo.replaceChildren(icon(Palette, 'w-5 h-5'));
  botaoEstilo.addEventListener('click', escolherEstilo);
  // O <head> já aplicou (só os ids conhecidos); aqui só garante o valor normalizado (as barras são pintadas abaixo).
  document.documentElement.dataset.estilo = estiloAtual();

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
