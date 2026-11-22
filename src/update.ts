import { CloudDownload, LoaderCircle, X } from 'lucide';
import { LATEST_RELEASE_API, pickUpdate, type UpdateInfo } from './domain/update';
import { androidBridge, UPDATE_EVENT, type UpdateStatus } from './platform';
import { btn, BTN_LINK, byId, h, icon } from './ui/dom';
import { showToast } from './ui/feedback';

/**
 * Atualização do APK. Com internet, o app consulta a última Release do GitHub toda vez que é aberto (e ao voltar
 * para ele, se a última consulta foi há mais de 1 h) e, se houver versão maior, mostra um aviso no topo que não
 * atrapalha o trabalho. "Procurar atualização" (rodapé) consulta na hora. "Atualizar" pede ao Android
 * (Updater.kt) para baixar o APK e abrir o instalador; o Android só aceita o APK assinado com a mesma chave e os
 * dados do app continuam. Sem internet, nada acontece. No navegador/PWA quem atualiza é o service worker.
 */

const LAST_CHECK_KEY = 'ferracine_prod:update-check';
/** Ao voltar para o app (ele continuou aberto), consulta de novo só depois deste intervalo. */
const RETORNO_MS = 60 * 60 * 1000;
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

/** A API respondeu com erro (ex.: limite de 60 consultas/h por IP): espera RETORNO_MS antes de tentar de novo. */
class ApiError extends Error {}
/** Resposta que não é a da API (Wi-Fi com página de login, proxy): há rede, mas o GitHub não foi alcançado. */
class RespostaEstranha extends Error {}

const API_ERROR_KEY = 'ferracine_prod:update-erro';

/** O GitHub recusou há menos de RETORNO_MS (vale até ao abrir: muitos celulares dividem o IP da operadora). */
function recusouHaPouco(): boolean {
  try {
    return Date.now() - (Number(localStorage.getItem(API_ERROR_KEY)) || 0) < RETORNO_MS;
  } catch {
    return false;
  }
}

function marcaRecusa(recusou: boolean): void {
  try {
    if (recusou) localStorage.setItem(API_ERROR_KEY, String(Date.now()));
    else localStorage.removeItem(API_ERROR_KEY);
  } catch {
    // sem armazenamento: nada a guardar
  }
}

/** null = já está na versão mais recente. Lança erro sem internet, em timeout ou se a API recusar. */
async function fetchUpdate(): Promise<UpdateInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`);
    const json: unknown = await res.json().catch(() => {
      throw new RespostaEstranha('resposta não é JSON');
    });
    return pickUpdate(json, __APP_VERSION__);
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
  const checkBtn = h('button', { type: 'button', id: 'btn-check-update', class: `${BTN_LINK} underline -my-3`, onClick: () => void check('manual') });
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
        busy ? null : h('button', { type: 'button', id: 'btn-update', class: btn('primary'), onClick: () => install(info) }, 'Atualizar'),
        h('button', { type: 'button', class: btn('ghost', 'icon'), 'aria-label': 'Agora não', title: 'Agora não', onClick: close }, icon(X, 'w-5 h-5')),
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

  /** `abertura`: o app acabou de abrir; `retorno`: voltou para ele; `manual`: "Procurar atualização". */
  async function check(quando: 'abertura' | 'retorno' | 'manual'): Promise<void> {
    const manual = quando === 'manual';
    // Sem sinal não tenta. Ao voltar para o app: não repete se já achou versão nova ou consultou há pouco.
    if (!manual && (!navigator.onLine || recusouHaPouco())) return;
    if (quando === 'retorno' && (available || Date.now() - lastCheck() < RETORNO_MS)) return;
    inflight ??= fetchUpdate().finally(() => (inflight = null));
    if (manual) setChecking(true);
    try {
      available = await inflight;
      markChecked();
      marcaRecusa(false);
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
        if (manual) showToast(`Você já está na versão mais recente (${__APP_VERSION__}).`, 'success');
      }
    } catch (e) {
      if (e instanceof ApiError) marcaRecusa(true); // GitHub recusou (limite de consultas): não insiste por 1 h
      if (manual) {
        showToast(
          e instanceof ApiError
            ? 'O GitHub não respondeu agora. Tente de novo mais tarde.'
            : e instanceof RespostaEstranha
              ? 'Esta rede não deixou consultar o GitHub (Wi-Fi com login?). Tente de novo mais tarde.'
              : 'Sem internet agora. A atualização é procurada sozinha quando houver sinal.',
          'warning',
        );
      }
    } finally {
      if (manual) setChecking(false);
    }
  }

  footer.append(' · ', checkBtn);
  void check('abertura');
  // Voltou para o app (talvez agora com sinal): tenta de novo, respeitando o intervalo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check('retorno');
  });
}
