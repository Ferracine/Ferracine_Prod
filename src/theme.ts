import { Moon, Sun } from 'lucide';
import { androidBridge } from './platform';
import { icon } from './ui/dom';

/**
 * Tema claro/escuro. O script no <head> do index.html aplica data-theme antes da primeira pintura (mesma chave e
 * regra: escolha salva, senão o tema do celular); aqui ficam o botão de alternar e o acompanhamento do celular.
 */

type Theme = 'light' | 'dark';

const KEY = 'ferracine_prod:theme';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function saved(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme, button: HTMLButtonElement): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Barra do sistema com a cor de fundo do tema (variável --app de styles.css).
  const bar = getComputedStyle(root).getPropertyValue('--app').trim();
  if (bar) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar);
    androidBridge?.setSystemBars(bar, theme === 'dark'); // no APK, as barras do Android seguem o tema do app
  }
  const next = theme === 'dark' ? 'claro' : 'escuro';
  button.setAttribute('aria-label', `Usar tema ${next}`);
  button.title = `Tema ${next}`;
  button.replaceChildren(icon(theme === 'dark' ? Sun : Moon, 'w-5 h-5'));
}

export function initTheme(button: HTMLButtonElement): void {
  apply(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', button);

  button.addEventListener('click', () => {
    const theme: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // sem armazenamento: o tema vale só até fechar o app
    }
    apply(theme, button);
  });

  // Sem escolha salva, acompanha o tema do celular.
  systemDark.addEventListener('change', () => {
    if (!saved()) apply(systemDark.matches ? 'dark' : 'light', button);
  });
}
