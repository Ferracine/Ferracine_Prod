/**
 * Ponte com o APK (android/: WebView + FerracineBridge.kt). No navegador/PWA ela não existe e o app usa as APIs web.
 * Na WebView, baixar um blob, abrir em nova aba e navigator.share não funcionam: o PDF vai em base64 para o
 * código nativo, que salva em Downloads, abre no leitor de PDF ou chama o compartilhamento do Android.
 * Cada método devolve "" em caso de sucesso ou a mensagem de erro.
 */
interface AndroidBridge {
  savePdf(base64: string, fileName: string): string;
  openPdf(base64: string, fileName: string): string;
  sharePdf(base64: string, fileName: string): string;
  /** Cor de fundo do tema (#rrggbb) e modo, para as barras de status e de navegação acompanharem o app. */
  setSystemBars(color: string, dark: boolean): void;
  /**
   * Baixa o APK da Release (só de github.com/.../releases/download/; `size` em bytes, 0 se desconhecido) e abre o
   * instalador. Volta na hora ("" ou
   * erro); o andamento chega pelo evento "ferracine-update" (src/update.ts).
   */
  installUpdate(url: string, size: number): string;
}

/** Evento disparado pelo Updater.kt (via MainActivity) com o andamento da atualização. */
export const UPDATE_EVENT = 'ferracine-update';

/** Detalhe do evento UPDATE_EVENT. */
export interface UpdateStatus {
  status: 'permission' | 'installing' | 'error';
  message?: string;
}

declare global {
  interface Window {
    FerracineAndroid?: AndroidBridge;
    /** Chamada pelo voltar do Android (MainActivity) antes de navegar: true = o app tratou (fechou uma janela). */
    ferracineBack?: () => boolean;
  }
}

export const androidBridge: AndroidBridge | undefined = window.FerracineAndroid;

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000; // evita estourar a pilha do String.fromCharCode em PDFs grandes
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}
