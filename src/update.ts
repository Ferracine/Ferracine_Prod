import { CloudDownload, LoaderCircle, X } from 'lucide';
import { LATEST_RELEASE_API, pickUpdate, type UpdateInfo } from './domain/update';
import { androidBridge, UPDATE_EVENT, type UpdateStatus } from './platform';
import { BTN, byId, h, icon } from './ui/dom';
import { showToast } from './ui/feedback';

/**
 * Atualização do APK. Com internet, o app consulta a última Release do GitHub (no máximo a cada 6 h quando não há
 * nada novo) e, se houver versão maior, mostra um aviso que não atrapalha o trabalho. "Atualizar" pede ao Android
 * (Updater.kt) para baixar o APK e abrir o instalador; o Android só aceita o APK assinado com a mesma chave e os
 * dados do app continuam. Sem internet, nada acontece. No navegador/PWA quem atualiza é o service worker.
 */

const LAST_CHECK_KEY = 'ferracine_prod:update-check';
const INTERVAL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;

function lastCheck(): number {
  try {
    return Number(localStorage.getItem(LAST_CHECK_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markChecked(): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch {
    // sem armazenamento: consulta de novo na próxima abertura
  }
}

/** A API respondeu com erro (ex.: limite de 60 consultas/h por IP): esperar o intervalo antes de tentar de novo. */
class ApiError extends Error {}

/** null = já está na versão mais recente. Lança erro sem internet, em timeout ou se a API recusar. */
async function fetchUpdate(): Promise<UpdateInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`);
    return pickUpdate(await res.json(), __APP_VERSION__);
  } finally {
    clearTimeout(timer);
  }
}

/** Texto do aviso de versão nova (sem o tamanho quando a Release não informa). */
function offerText(info: UpdateInfo): string {
  const mb = (info.size / 1_048_576).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `Nova versão ${info.version} disponível${info.size > 0 ? ` (${mb} MB)` : ''}.`;
}

export function initUpdates(): void {
  const footer = byId('app-version');
  footer.replaceChildren(`Versão ${__APP_VERSION__}`);
  const bridge = androidBridge;
  if (!bridge) return;

  const banner = byId('update-banner');
  const footerEl = footer.closest('footer')!;
  const checkBtn = h('button', { type: 'button', id: 'btn-check-update', class: 'underline font-semibold text-brand-fg inline-flex items-center gap-1', onClick: () => void check(true) });
  /** "Procurar atualização" ↔ carregando (ícone girando, desativado) enquanto a consulta do toque não volta. */
  const setChecking = (busy: boolean) => {
    checkBtn.disabled = busy;
    checkBtn.setAttribute('aria-busy', String(busy));
    checkBtn.replaceChildren(...(busy ? [icon(LoaderCircle, 'w-3.5 h-3.5 animate-spin'), 'Procurando...'] : ['Procurar atualização']));
  };
  setChecking(false);
  /**
   * Onde o aviso aparece: achado pelo "Procurar atualização" (o eletricista está no rodapé), no rodapé, acima do
   * "© Ferracine Prod"; achado sozinho ao abrir o app, no topo da tela.
   */
  const placeBanner = (inFooter: boolean) => {
    if (inFooter) footerEl.prepend(banner);
    else byId('app').before(banner);
    banner.className = `${inFooter ? 'max-w-3xl w-full mx-auto pb-3 text-left' : 'max-w-3xl w-full mx-auto px-4 pt-4'} hidden`;
  };
  /** Versão nova encontrada nesta abertura do app (não consulta de novo até reabrir, salvo pelo botão do rodapé). */
  let available: UpdateInfo | null = null;
  /** Versão sendo baixada/instalada: o andamento do Updater.kt fala dela, mesmo que uma consulta mude `available`. */
  let installing: UpdateInfo | null = null;
  /** Consulta em andamento, compartilhada: o toque em "Procurar atualização" espera a automática em vez de sumir. */
  let inflight: Promise<UpdateInfo | null> | null = null;

  const close = () => {
    banner.classList.add('hidden');
    banner.replaceChildren();
  };

  /** Aviso de versão nova (topo ou rodapé, ver placeBanner); `busy` = baixando (só dá para esconder; o download continua). */
  const render = (info: UpdateInfo, text: string, busy = false) => {
    banner.replaceChildren(
      h(
        'div',
        { class: 'bg-card border border-brand/40 rounded-2xl p-4 flex items-center gap-3 shadow-lg' },
        icon(busy ? LoaderCircle : CloudDownload, `w-6 h-6 shrink-0 text-brand-fg${busy ? ' animate-spin' : ''}`),
        h('p', { class: 'flex-1 text-sm font-semibold text-fg', 'data-testid': 'update-text' }, text),
        busy ? null : h('button', { type: 'button', id: 'btn-update', class: BTN.primary, onClick: () => install(info) }, 'Atualizar'),
        h('button', { type: 'button', class: 'p-2 rounded-xl text-muted hover:bg-fg/10', 'aria-label': 'Agora não', title: 'Agora não', onClick: close }, icon(X, 'w-5 h-5')),
      ),
    );
    banner.classList.remove('hidden');
  };

  const install = (info: UpdateInfo) => {
    const error = bridge.installUpdate(info.url, info.size);
    if (error) {
      showToast(error, 'error');
      return;
    }
    installing = info;
    render(info, `Baixando a versão ${info.version}...`, true);
  };

  // Andamento vindo do Updater.kt (download, permissão, instalador).
  window.addEventListener(UPDATE_EVENT, (ev) => {
    const { status, message } = (ev as CustomEvent<UpdateStatus>).detail;
    const info = installing;
    if (!info) return;
    if (status === 'permission') {
      render(info, 'Permita "Instalar apps desconhecidos" para a Folha de Produção e volte para o app: a instalação continua sozinha.');
    } else if (status === 'installing') {
      render(info, `Confirme a instalação da versão ${info.version} na janela do Android. Os dados do turno continuam no app.`);
    } else {
      installing = null;
      showToast(message || 'Não foi possível baixar a atualização. Tente de novo.', 'error');
      render(info, offerText(info));
    }
  });

  async function check(manual: boolean): Promise<void> {
    // Automático: sem sinal, com versão nova já encontrada ou consultado há pouco, não gasta dados nem a cota da API.
    if (!manual && (!navigator.onLine || available || Date.now() - lastCheck() < INTERVAL_MS)) return;
    inflight ??= fetchUpdate().finally(() => (inflight = null));
    if (manual) setChecking(true);
    try {
      available = await inflight;
      if (available) {
        if (installing) {
          // Não apaga o "Baixando..." de um download em curso; o toque ainda recebe resposta.
          if (manual) showToast(`A versão ${installing.version} já está sendo baixada e instalada.`, 'info');
        } else if (manual) {
          placeBanner(true);
          render(available, offerText(available));
          banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (banner.classList.contains('hidden')) {
          // A automática só mostra o aviso se ele não estiver na tela (não tira do rodapé o que o toque pôs lá).
          placeBanner(false);
          render(available, offerText(available));
        }
      } else {
        markChecked();
        if (manual) showToast(`Você já está na versão mais recente (${__APP_VERSION__}).`, 'success');
      }
    } catch (e) {
      if (e instanceof ApiError) markChecked(); // GitHub recusou (limite de consultas): espera o intervalo
      if (manual) {
        showToast(
          e instanceof ApiError ? 'O GitHub não respondeu agora. Tente de novo mais tarde.' : 'Sem internet agora. A atualização é procurada sozinha quando houver sinal.',
          'warning',
        );
      }
    } finally {
      if (manual) setChecking(false);
    }
  }

  footer.append(' · ', checkBtn);
  void check(false);
  // Voltou para o app (talvez agora com sinal): tenta de novo, respeitando o intervalo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check(false);
  });
}
