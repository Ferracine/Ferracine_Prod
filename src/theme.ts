import { Check, Moon, Palette, Sun } from 'lucide';
import { androidBridge } from './platform';
import { botaoDoTopo, BTN_CHOICE, ESCOLHA_OFF, ESCOLHA_ON, h, icon } from './ui/dom';
import { closeModal, openModal } from './ui/feedback';

/**
 * Aparência em dois eixos independentes, gravados no aparelho e aplicados no <html>:
 * - estilo (`data-estilo`): tema completo e independente (superfícies, botões, bordas e tipografia em `ESTILOS`);
 * - variante (`data-theme`): `light` ou `dark` (sem escolha salva, segue o celular).
 * Nenhum tema herda cores do logotipo; cada estilo possui identidade cromática própria em styles.css.
 */

type Theme = 'light' | 'dark';
type GrupoEstilo = 'Paletas modernas' | 'Especiais e clássicos';

interface EstiloDef {
  readonly id: string;
  readonly grupo: GrupoEstilo;
  readonly nome: string;
  readonly descricao: string;
}

/** Lista única de temas (fonte de verdade). Cada tema possui paleta de botões e superfícies exclusiva (claro + escuro). */
const ESTILOS = [
  { id: 'moderno', grupo: 'Paletas modernas', nome: 'Tema 1: Safira & Violeta', descricao: 'Cantos arredondados, botões em azul safira e violeta real.' },
  { id: 'floresta', grupo: 'Paletas modernas', nome: 'Tema 2: Esmeralda & Ouro', descricao: 'Superfície sálvia suave com botões esmeralda e ouro velho.' },
  { id: 'sol-forte', grupo: 'Paletas modernas', nome: 'Tema 3: Alto Contraste', descricao: 'Branco solar / preto OLED puro, bordas de 2 px, ultramar e púrpura.' },
  { id: 'win98', grupo: 'Especiais e clássicos', nome: 'Tema 4: Windows 98', descricao: 'Esquema Windows Standard: face #C0C0C0 em relevo, título azul-marinho; escuro High Contrast Black.' },
  { id: 'xp', grupo: 'Especiais e clássicos', nome: 'Tema 5: Windows XP', descricao: 'Luna azul: botões com borda #003C74 e brilho laranja; escuro Royale Noir (moldura escura).' },
  { id: 'win10', grupo: 'Especiais e clássicos', nome: 'Tema 6: Windows 10', descricao: 'Claro e escuro do Windows 10: botões cinza com borda de 2 px e destaque #0078D7.' },
] as const satisfies readonly EstiloDef[];

type Estilo = (typeof ESTILOS)[number]['id'];

const GRUPOS: readonly GrupoEstilo[] = ['Paletas modernas', 'Especiais e clássicos'];
const KEY = 'ferracine_prod:theme';
const ESTILO_KEY = 'ferracine_prod:estilo';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function ler(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function guardar(key: string, valor: string): void {
  try {
    localStorage.setItem(key, valor);
  } catch {
    // sem armazenamento: vale só até fechar o app
  }
}

function savedTheme(): Theme | null {
  const t = ler(KEY);
  return t === 'light' || t === 'dark' ? t : null;
}

const temaAtual = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

function normalizarEstilo(): Estilo {
  const salvo = ler(ESTILO_KEY);
  const bruto = salvo ?? document.documentElement.dataset.estilo;
  if (bruto === 'retro') {
    guardar(ESTILO_KEY, 'win98');
    return 'win98';
  }
  const valido = ESTILOS.find((e) => e.id === bruto)?.id;
  if (valido) return valido;
  if (salvo !== null) guardar(ESTILO_KEY, 'moderno');
  return 'moderno';
}

function canal(v: string | undefined): number {
  return Math.max(0, Math.min(255, Math.round(Number(v) || 0)));
}

/**
 * Converte a cor computada do body em #rrggbb de 6 dígitos (Color.parseColor do Android recusa #fff/#000) e calcula
 * a luminância real da barra para escolher ícones claros ou escuros no sistema.
 */
function lerCorDaBarra(): { hex: string; escura: boolean } | null {
  const m = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3 || m[3] === '0') return null;
  const r = canal(m[0]);
  const g = canal(m[1]);
  const b = canal(m[2]);
  const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  return { hex, escura: 0.299 * r + 0.587 * g + 0.114 * b < 140 };
}

/** Sincroniza meta theme-color e barras do Android com o fundo atual do tema. */
function pintarBarras(): void {
  const cor = lerCorDaBarra();
  if (!cor) return;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor.hex);
  androidBridge?.setSystemBars(cor.hex, cor.escura);
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

/** Miniatura fiel da paleta (fundo, cartão, faixa de título e pílulas dos dois tons de botão). */
function miniatura(id: Estilo, theme: Theme): HTMLElement {
  return h(
    'span',
    { 'data-estilo': id, 'data-theme': theme, class: 'amostra shrink-0 w-16 h-12 border border-fg/25 p-1.5 flex items-center justify-center', 'aria-hidden': 'true' },
    h(
      'span',
      { class: 'amostra-janela w-full h-full flex flex-col justify-between overflow-hidden' },
      h('span', { class: 'amostra-titulo block h-2.5 w-full' }),
      h(
        'span',
        { class: 'flex items-center gap-1 px-1.5 pb-1' },
        h('span', { class: 'amostra-brand h-2 flex-1' }),
        h('span', { class: 'amostra-accent h-2 flex-1' }),
      ),
    ),
  );
}

/** Janela com todos os temas e alternador Claro/Escuro ao vivo para comparar as paletas. */
function escolherEstilo(botaoTemaTopo: HTMLButtonElement): void {
  const atual = normalizarEstilo();
  const amostras: HTMLElement[] = [];

  const modoBtns = (
    [
      { id: 'light', rotulo: 'Claro', icone: Sun },
      { id: 'dark', rotulo: 'Escuro', icone: Moon },
    ] as const
  ).map((m) =>
    h(
      'button',
      {
        type: 'button',
        'data-modo-cor': m.id,
        class: `${BTN_CHOICE} flex-1 min-h-11 px-3 text-xs`,
        onClick: () => trocarModoNaJanela(m.id),
      },
      icon(m.icone, 'w-4 h-4'),
      m.rotulo,
    ),
  );

  const sincronizarModoBtns = (theme: Theme) => {
    for (const b of modoBtns) {
      const ativo = b.dataset.modoCor === theme;
      b.setAttribute('aria-pressed', String(ativo));
      for (const c of ESCOLHA_ON.split(' ')) b.classList.toggle(c, ativo);
      for (const c of ESCOLHA_OFF.split(' ')) b.classList.toggle(c, !ativo);
    }
    for (const a of amostras) a.dataset.theme = theme;
  };

  const trocarModoNaJanela = (theme: Theme) => {
    guardar(KEY, theme);
    applyTheme(theme, botaoTemaTopo);
    sincronizarModoBtns(theme);
  };

  const secoes = GRUPOS.map((grupo) => {
    const itens = ESTILOS.filter((e) => e.grupo === grupo).map((e) => {
      const prev = miniatura(e.id, temaAtual());
      amostras.push(prev);
      const selecionado = e.id === atual;
      return h(
        'button',
        {
          type: 'button',
          'data-estilo-opcao': e.id,
          'aria-pressed': String(selecionado),
          class: `${BTN_CHOICE} w-full justify-start text-left gap-3 p-3 min-h-16 ${selecionado ? 'border-brand bg-brand/10 text-fg' : ESCOLHA_OFF}`,
          onClick: () => {
            guardar(ESTILO_KEY, e.id);
            applyEstilo(e.id);
            closeModal();
          },
        },
        prev,
        h(
          'span',
          { class: 'flex-1 min-w-0' },
          h('span', { class: 'block text-sm font-extrabold text-fg' }, e.nome),
          h('span', { class: 'block text-xs font-medium text-muted' }, e.descricao),
        ),
        selecionado && icon(Check, 'w-5 h-5 shrink-0 text-brand-fg'),
      );
    });
    return h('div', { class: 'space-y-2' }, h('p', { class: 'lbl mb-1' }, grupo), itens);
  });

  sincronizarModoBtns(temaAtual());

  openModal(
    'Escolha o tema',
    h(
      'div',
      { class: 'space-y-4' },
      h(
        'div',
        { class: 'space-y-1.5' },
        h('p', { class: 'lbl mb-0' }, 'Variante de luminosidade'),
        h('div', { class: 'flex gap-2', role: 'group', 'aria-label': 'Variante clara ou escura' }, modoBtns),
      ),
      secoes,
      h('p', { class: 'text-xs text-muted pt-1' }, 'Cada tema possui paleta própria e independente. O PDF oficial não muda com o tema.'),
    ),
    [{ label: 'Fechar', variant: 'neutral', onClick: closeModal }],
  );
}

/** Inicializa os botões do topo (lista de temas e claro ↔ escuro) e acompanha o sistema. */
export function initTheme(slotTema: HTMLElement, slotEstilo: HTMLElement): void {
  document.documentElement.dataset.estilo = normalizarEstilo();

  const botaoTema = botaoDoTopo(slotTema, Moon, 'Usar tema escuro', () => {
    const next: Theme = temaAtual() === 'dark' ? 'light' : 'dark';
    guardar(KEY, next);
    applyTheme(next, botaoTema);
  });

  botaoDoTopo(slotEstilo, Palette, 'Escolher o tema', () => escolherEstilo(botaoTema));
  applyTheme(temaAtual(), botaoTema);

  systemDark.addEventListener('change', () => {
    if (!savedTheme()) applyTheme(systemDark.matches ? 'dark' : 'light', botaoTema);
  });
}
