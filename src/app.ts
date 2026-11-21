import { FileDown } from 'lucide';
import { SERVICE_LABEL } from './domain/catalog';
import { osLabel, pdfFileName, plural } from './domain/format';
import * as ordem from './domain/ordem';
import type { AppData, ClosedSheet, OrdemServico, OSDraft, ShiftHeader } from './domain/types';
import { androidBridge, blobToBase64 } from './platform';
import { loadData, saveData, type KeyValueStore } from './storage';
import { dashboardScreen } from './ui/dashboard-screen';
import { CALLOUT, byId, h, icon } from './ui/dom';
import { closeModal, confirmModal, isModalOpen, openModal, showToast, type ModalAction } from './ui/feedback';
import { headerScreen } from './ui/header-screen';
import { osScreen } from './ui/os-screen';

/** `new` = OS nova em preenchimento (rascunho salvo); `edit` = lápis de uma OS concluída. Mesma tela da OS. */
type Screen = 'header' | 'dashboard' | 'new' | 'edit';
type PdfModule = typeof import('./pdf');
/** PDF serializado uma vez; baixar, abrir e compartilhar reaproveitam o mesmo Blob (e, no APK, o mesmo base64). */
type Pdf = { blob: Blob; fileName: string; base64?: string };

function newId(): string {
  // randomUUID só existe em contexto seguro (https/localhost); no teste pela rede local cai no fallback.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function canShareFiles(): boolean {
  if (androidBridge) return true; // no APK, o compartilhamento é o do Android
  try {
    const probe = new File([''], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// --- PDF ---------------------------------------------------------------------
// jsPDF só é carregado quando preciso (gerar, ou pré-carregar na tela inicial para o Compartilhar).

let pdfModule: PdfModule | null = null;
let pdfModuleLoading: Promise<PdfModule> | null = null;

function loadPdfModule(): Promise<PdfModule> {
  pdfModuleLoading ??= import('./pdf').then((mod) => (pdfModule = mod));
  return pdfModuleLoading;
}

/** Último PDF montado, pela folha de origem: evita remontar a cada toque. */
let pdfMemo: { sheet: ClosedSheet; pdf: Pdf } | null = null;

function buildPdf(mod: PdfModule, sheet: ClosedSheet): Pdf {
  if (pdfMemo?.sheet === sheet) return pdfMemo.pdf;
  const doc = mod.buildSheetPdf(sheet.header, sheet.ordens, sheet.tecnicos);
  const pdf = { blob: doc.output('blob'), fileName: pdfFileName(sheet.header, sheet.ordens.length) };
  pdfMemo = { sheet, pdf };
  return pdf;
}

async function sheetPdf(sheet: ClosedSheet): Promise<Pdf> {
  return buildPdf(pdfModule ?? (await loadPdfModule()), sheet);
}

/** No APK, entrega o PDF ao código nativo; devolve true se a ponte tratou o pedido. */
async function viaAndroid(action: 'savePdf' | 'openPdf' | 'sharePdf', pdf: Pdf, ok?: string): Promise<boolean> {
  if (!androidBridge) return false;
  pdf.base64 ??= await blobToBase64(pdf.blob);
  const error = androidBridge[action](pdf.base64, pdf.fileName);
  if (error) showToast(error, 'error');
  else if (ok) showToast(ok, 'success');
  return true;
}

async function downloadPdf(pdf: Pdf): Promise<void> {
  if (await viaAndroid('savePdf', pdf, `PDF salvo em Downloads: ${pdf.fileName}`)) return;
  const url = URL.createObjectURL(pdf.blob);
  const a = h('a', { href: url, download: pdf.fileName, class: 'hidden' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function openPdf(pdf: Pdf): Promise<void> {
  if (await viaAndroid('openPdf', pdf)) return;
  const url = URL.createObjectURL(pdf.blob);
  if (!window.open(url, '_blank')) {
    showToast('O navegador bloqueou a abertura. Use "Baixar PDF" ou "Compartilhar".', 'warning');
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

async function sharePdf(pdf: Pdf): Promise<void> {
  if (await viaAndroid('sharePdf', pdf)) return;
  try {
    const file = new File([pdf.blob], pdf.fileName, { type: 'application/pdf' });
    await navigator.share({ files: [file], title: pdf.fileName });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return; // usuário fechou o compartilhamento
    console.error('Erro ao compartilhar PDF:', error);
    showToast('Não foi possível compartilhar. Use "Baixar PDF".', 'warning');
  }
}

export function startApp(root: HTMLElement, store: KeyValueStore): void {
  let data: AppData = loadData(store);
  let editingHeader = false;
  /** OS aberta na tela de edição (lápis). Só em memória: a OS salva muda apenas em "Salvar alterações". */
  let editing: { os: OrdemServico; dirty: boolean } | null = null;
  let shownScreen: Screen | null = null;
  let generating = false;
  const shareSupported = canShareFiles();

  let saveFailed = false;

  /**
   * Grava no aparelho e avisa se falhar. `quiet`: gravação automática do rascunho a cada tecla, que avisa só na
   * primeira falha seguida (senão seria um aviso por letra); ações do usuário (salvar, excluir...) avisam sempre.
   */
  function persist(quiet = false): void {
    const ok = saveData(store, data);
    if (!ok && !(quiet && saveFailed)) showToast('Não foi possível salvar no aparelho. Libere espaço e não feche o app.', 'error');
    saveFailed = !ok;
  }

  function update(mutate: (d: AppData) => void, rerender = true): void {
    mutate(data);
    persist();
    if (rerender) render();
  }

  /** Abre, troca ou fecha o rascunho da OS nova. */
  function setDraft(draft: OSDraft | null): void {
    update((d) => { d.draft = draft; });
  }

  /** Alteração na tela da OS nova: grava o rascunho sem redesenhar (a tela guarda o próprio estado). */
  function touchDraft(edit: ordem.OSEdit): void {
    data.draft = { ...data.draft!, ...edit };
    persist(true);
  }

  function currentScreen(): Screen {
    if (!data.header || editingHeader) return 'header';
    if (editing) return 'edit';
    return data.draft ? 'new' : 'dashboard';
  }

  function render(): void {
    const screen = currentScreen();
    const badge = byId('badge-status');
    let view: HTMLElement;

    if (screen === 'header') {
      badge.textContent = editingHeader ? 'Corrigindo cabeçalho' : 'Aguardando cabeçalho';
      view = headerScreen({
        editing: editingHeader ? data.header : null,
        defaults: data.lastHeader,
        getTecnicos: () => data.tecnicos,
        onAddTecnico: addTecnico,
        onRemoveTecnico: removeTecnico,
        lastSheet: data.lastSheet,
        canShare: shareSupported,
        onSubmit: submitHeader,
        onCancelEdit: () => { editingHeader = false; render(); },
        onDownloadLast: () => void deliverLastSheet('download'),
        onShareLast: () => void deliverLastSheet('share'),
      });
    } else if (screen === 'edit') {
      const current = editing!;
      badge.textContent = `Editando OS ${osLabel(current.os.osNumber)}`;
      view = osScreen({
        mode: 'edit',
        serviceType: current.os.serviceType,
        initial: current.os,
        onChange: () => { current.dirty = true; },
        onSave: (edit) => saveEdit(current.os, edit),
        onCancel: cancelEdit,
      });
    } else if (screen === 'new') {
      const draft = data.draft!;
      badge.textContent = 'Nova OS';
      view = osScreen({
        mode: 'new',
        serviceType: draft.serviceType,
        initial: draft,
        // Rascunho gravado a cada alteração: fechar o app no meio não perde a OS.
        onChange: touchDraft,
        onSave: saveNew,
        onCancel: cancelNew,
      });
    } else {
      badge.textContent = `Turno ativo (${plural(data.ordens.length, 'OS', 'OSs')})`;
      view = dashboardScreen({
        header: data.header!,
        ordens: data.ordens,
        onNewOS: (type) => setDraft(ordem.startDraft(type)),
        onView: viewOS,
        onEdit: openEdit,
        onDelete: deleteOS,
        onEditHeader: () => { editingHeader = true; render(); },
        onFinish: confirmFinish,
      });
    }

    root.replaceChildren(view);
    if (screen !== shownScreen) window.scrollTo({ top: 0, behavior: 'smooth' });
    shownScreen = screen;
    syncBackButton(screen);
    // Compartilhar precisa chamar navigator.share logo após o toque: deixa o jsPDF carregado em segundo plano.
    if (screen === 'header' && !editingHeader && data.lastSheet && shareSupported) {
      const whenIdle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200)); // Safari não tem requestIdleCallback
      whenIdle(() => void loadPdfModule().catch((error) => console.error('Erro ao carregar o gerador de PDF:', error)));
    }
  }

  // --- Número da OS repetido ----------------------------------------------

  /** Executa `action`, pedindo confirmação antes se outra OS da folha já usa `osNumber`. */
  function confirmIfDuplicate(osNumber: string, exceptId: string | undefined, action: () => void): void {
    const duplicate = !!osNumber && data.ordens.some((o) => o.osNumber === osNumber && o.id !== exceptId);
    if (!duplicate) {
      action();
      return;
    }
    confirmModal(
      'OS já registrada',
      `A OS ${osNumber} já está nesta folha. Deseja registrar outro atendimento para ela?`,
      { label: 'Registrar mesmo assim', variant: 'primary' },
      action,
    );
  }

  // --- Cabeçalho e técnicos ------------------------------------------------

  function submitHeader(header: ShiftHeader): void {
    const wasEditing = editingHeader;
    editingHeader = false;
    update((d) => {
      d.header = header;
      d.lastHeader = header; // preenche o próximo turno
    });
    showToast(wasEditing ? 'Cabeçalho atualizado.' : 'Turno iniciado! Registro de OSs liberado.', 'success');
  }

  // Um líder excluído deixa de aparecer: o seletor cai em "—" e o PDF não marca ninguém (ids desconhecidos são ignorados).
  function addTecnico(nome: string, telefone: string): void {
    update((d) => { d.tecnicos = [...d.tecnicos, { id: newId(), nome, telefone }]; }, false);
  }

  function removeTecnico(id: string): void {
    update((d) => { d.tecnicos = d.tecnicos.filter((t) => t.id !== id); }, false);
  }

  // --- Painel --------------------------------------------------------------

  function viewOS(os: OrdemServico): void {
    const rows = ordem.answerRows(os).map((r, i) =>
      h(
        'div',
        { class: 'border-b border-fg/10 pb-2.5 last:border-none' },
        h('p', { class: 'text-xs font-bold text-muted' }, `${i + 1}. ${r.question}`),
        h('p', { class: `text-sm font-semibold mt-0.5 ${r.skipped ? 'text-subtle italic' : r.isDitais ? 'text-danger-fg' : 'text-fg'}` }, r.display),
      ),
    );
    openModal(`OS ${osLabel(os.osNumber)} (${SERVICE_LABEL[os.serviceType]} - Cód. ${os.serviceCode})`, h('div', { class: 'space-y-3' }, rows), [
      { label: 'Editar', variant: 'neutral', onClick: () => { closeModal(); openEdit(os); } },
      { label: 'Fechar', variant: 'primary', onClick: closeModal },
    ]);
  }

  function deleteOS(os: OrdemServico): void {
    confirmModal(
      'Excluir Ordem de Serviço',
      `Tem certeza que deseja remover a OS ${osLabel(os.osNumber)} (código ${os.serviceCode}) desta folha?`,
      { label: 'Sim, excluir', variant: 'danger' },
      () => {
        update((d) => { d.ordens = d.ordens.filter((o) => o.id !== os.id); });
        showToast('Ordem de serviço removida.', 'info');
      },
    );
  }

  // --- Edição completa de OS (lápis) --------------------------------------

  function openEdit(os: OrdemServico): void {
    editing = { os, dirty: false };
    render();
  }

  function closeEdit(): void {
    editing = null;
    render();
  }

  /** Regra não cumprida (código, DITAIS, complemento do SIM): avisa e rola até o campo. */
  function showRuleError(result: ordem.RuleError): void {
    showToast(result.error, 'warning');
    const field = document.querySelector(`[data-field="${result.field}"]`);
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }

  function saveEdit(original: OrdemServico, edit: ordem.OSEdit): void {
    const result = ordem.applyEdit(original, edit);
    if (!result.ok) {
      showRuleError(result);
      return;
    }
    const saved = result.os;
    const commit = () => {
      editing = null;
      update((d) => { d.ordens = d.ordens.map((o) => (o.id === saved.id ? saved : o)); });
      showToast(`OS ${osLabel(saved.osNumber)} atualizada.`, 'success');
    };
    if (saved.osNumber !== original.osNumber) confirmIfDuplicate(saved.osNumber, saved.id, commit);
    else commit();
  }

  function cancelEdit(): void {
    if (!editing?.dirty) {
      closeEdit();
      return;
    }
    confirmModal('Descartar alterações', 'Sair sem salvar? A OS continua como estava.', { label: 'Descartar alterações', variant: 'danger' }, closeEdit, 'Continuar editando');
  }

  // --- OS nova --------------------------------------------------------------

  function saveNew(edit: ordem.OSEdit): void {
    const result = ordem.createOS({ ...data.draft!, ...edit }, newId(), new Date());
    if (!result.ok) {
      showRuleError(result);
      return;
    }
    const saved = result.os;
    confirmIfDuplicate(saved.osNumber, undefined, () => {
      update((d) => {
        d.ordens = [...d.ordens, saved];
        d.draft = null;
      });
      showToast(`OS ${osLabel(saved.osNumber)} adicionada à folha de produção!`, 'success');
    });
  }

  /** Sai da OS nova; só pede confirmação se algo foi preenchido. */
  function cancelNew(): void {
    if (ordem.isUnchanged(data.draft!)) {
      setDraft(null);
      return;
    }
    confirmModal(
      'Cancelar registro da OS',
      'Deseja sair sem salvar esta OS? O que foi preenchido nela será descartado.',
      { label: 'Descartar OS', variant: 'danger' },
      () => setDraft(null),
      'Continuar preenchendo',
    );
  }

  // Botão/gesto "voltar" do Android: na tela da OS (nova ou edição) ele faz o mesmo que o Cancelar da tela
  // (em vez de fechar o app). Uma entrada extra no histórico "segura" o voltar enquanto essas telas estão abertas.
  // Depois de recarregar, a entrada da sessão anterior ainda é a atual: reaproveita em vez de empilhar outra.
  let backTrap = (history.state as { ferracineBackTrap?: boolean } | null)?.ferracineBackTrap === true;
  const trapsBack = (screen: Screen) => screen === 'new' || screen === 'edit';

  function syncBackButton(screen: Screen): void {
    if (trapsBack(screen) && !backTrap) {
      history.pushState({ ferracineBackTrap: true }, '');
      backTrap = true;
    } else if (!trapsBack(screen) && backTrap) {
      backTrap = false;
      history.back(); // desfaz a entrada extra ao sair pelos botões da tela (o popstate é ignorado abaixo)
    }
  }

  // APK: o voltar do Android chama esta função antes de tudo (MainActivity). Com uma janela aberta (ver respostas,
  // confirmações, PDF), fecha a janela em vez de voltar ou sair do app. Sem janela, segue o fluxo normal.
  window.ferracineBack = () => {
    if (!isModalOpen()) return false;
    closeModal();
    return true;
  };

  window.addEventListener('popstate', () => {
    if (!backTrap) return;
    backTrap = false;
    if (isModalOpen()) closeModal();
    else if (currentScreen() === 'edit') cancelEdit();
    else cancelNew();
    syncBackButton(currentScreen()); // ainda na tela: segura o próximo voltar
  });

  // --- PDF e encerramento do turno ----------------------------------------

  function confirmFinish(): void {
    const n = data.ordens.length;
    if (n === 0) {
      confirmModal(
        'Nenhuma OS registrada',
        'Você ainda não registrou nenhuma Ordem de Serviço neste turno. Deseja gerar a folha em branco mesmo assim?',
        { label: 'Gerar mesmo assim', variant: 'neutral' },
        () => void generatePdf(),
        'Voltar e adicionar OS',
      );
      return;
    }
    const semNumero = data.ordens.filter((o) => !o.osNumber).length;
    const body = h(
      'div',
      { class: 'space-y-3' },
      h('p', null, `Você está prestes a gerar o Espelho de Campo com ${plural(n, 'Ordem de Serviço', 'Ordens de Serviço')}.`),
      semNumero > 0 &&
        h('div', { class: CALLOUT.danger }, `${plural(semNumero, 'OS está', 'OSs estão')} sem número (S/N). Use o lápis na lista para preencher antes de gerar, se quiser.`),
      h('div', { class: CALLOUT.warning }, 'O turno só é encerrado quando você tocar em "Encerrar turno", depois de ter o PDF em mãos.'),
    );
    confirmModal('Finalizar turno e gerar PDF', body, { label: h('span', { class: 'flex items-center gap-2' }, icon(FileDown), 'Gerar PDF'), variant: 'accent' }, () => void generatePdf());
  }

  async function generatePdf(): Promise<void> {
    // Toque duplo enquanto o jsPDF carrega não pode gerar duas vezes.
    if (generating || !data.header) return;
    generating = true;
    const sheet: ClosedSheet = { header: data.header, ordens: data.ordens, fechadaEm: new Date().toISOString(), tecnicos: data.tecnicos };
    let pdf: Pdf;
    try {
      pdf = await sheetPdf(sheet);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showToast('Erro ao gerar o PDF. Os dados do turno foram mantidos; tente novamente.', 'error');
      return;
    } finally {
      generating = false;
    }

    void downloadPdf(pdf);

    // Foco inicial em Compartilhar/Baixar, nunca no "Encerrar turno".
    const actions: ModalAction[] = [
      { label: 'Baixar PDF', variant: 'neutral', autofocus: true, onClick: () => void downloadPdf(pdf) },
      { label: 'Abrir PDF', variant: 'neutral', onClick: () => void openPdf(pdf) },
      { label: 'Encerrar turno', variant: 'accent', onClick: () => { closeModal(); closeShift(sheet); } },
    ];
    if (shareSupported) actions.unshift({ label: 'Compartilhar', variant: 'primary', autofocus: true, onClick: () => void sharePdf(pdf) });

    openModal(
      'PDF gerado',
      h(
        'div',
        { class: 'space-y-3' },
        h('p', null, 'Arquivo: ', h('strong', { class: 'text-fg break-all' }, pdf.fileName)),
        h('p', { class: 'text-muted' }, 'Confira se o PDF foi salvo. Se não baixou, use os botões abaixo.'),
        h(
          'div',
          { class: CALLOUT.warning },
          h('strong', null, 'Só toque em "Encerrar turno" depois de ter o PDF em mãos.'),
          ' Isso limpa as OSs e o cabeçalho deste turno (o último PDF continua disponível na tela inicial).',
        ),
      ),
      actions,
    );
  }

  /** `sheet` é o mesmo objeto do PDF gerado: o memo serve o "Baixar/Compartilhar" da tela inicial sem remontar. */
  function closeShift(sheet: ClosedSheet): void {
    update((d) => {
      d.lastSheet = sheet;
      d.header = null;
      d.ordens = [];
      d.draft = null;
    });
    showToast('Turno encerrado. Os dados da equipe já ficam preenchidos para o próximo turno.', 'success');
  }

  async function deliverLastSheet(mode: 'download' | 'share'): Promise<void> {
    const sheet = data.lastSheet;
    if (!sheet) return;
    try {
      // Com o módulo já carregado, monta na hora (síncrono) e o compartilhamento ainda conta como resposta ao toque.
      const pdf = pdfModule ? buildPdf(pdfModule, sheet) : await sheetPdf(sheet);
      if (mode === 'download') await downloadPdf(pdf);
      else await sharePdf(pdf);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showToast('Não foi possível gerar o PDF.', 'error');
    }
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeModal();
  });

  render();
}
