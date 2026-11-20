import { FileDown, Share2 } from 'lucide';
import { SERVICE_LABEL } from './domain/catalog';
import { pdfFileName, plural } from './domain/format';
import type { AppData, ClosedSheet, OrdemServico, ServiceType, ShiftHeader, WizardDraft } from './domain/types';
import * as wiz from './domain/wizard';
import { loadData, saveData, type KeyValueStore } from './storage';
import { dashboardScreen } from './ui/dashboard-screen';
import { byId, h, icon } from './ui/dom';
import { closeModal, confirmModal, openModal, showToast, type ModalAction } from './ui/feedback';
import { headerScreen } from './ui/header-screen';
import { wizardScreen } from './ui/wizard-screen';

type Screen = 'header' | 'dashboard' | 'wizard';

function newId(): string {
  // randomUUID só existe em contexto seguro (https/localhost); no teste pela rede local cai no fallback.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function canShareFiles(): boolean {
  try {
    const probe = new File([''], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

async function sheetPdf(sheet: ClosedSheet) {
  // jsPDF é carregado só na hora de gerar: deixa a abertura do app leve.
  const { buildSheetPdf } = await import('./pdf');
  const doc = buildSheetPdf(sheet.header, sheet.ordens, new Date(sheet.fechadaEm));
  return { doc, fileName: pdfFileName(sheet.header) };
}

export function startApp(root: HTMLElement, store: KeyValueStore): void {
  let data: AppData = loadData(store);
  let editingHeader = false;
  let shownScreen: Screen | null = null;
  const shareSupported = canShareFiles();

  function persist(): void {
    if (!saveData(store, data)) {
      showToast('Não foi possível salvar no aparelho. Libere espaço e não feche o app.', 'error');
    }
  }

  function update(mutate: (d: AppData) => void, rerender = true): void {
    mutate(data);
    persist();
    if (rerender) render();
  }

  function setDraft(draft: WizardDraft, rerender = true): void {
    update((d) => { d.draft = draft; }, rerender);
  }

  function currentScreen(): Screen {
    if (!data.header || editingHeader) return 'header';
    return data.draft ? 'wizard' : 'dashboard';
  }

  function render(): void {
    const screen = currentScreen();
    const badge = byId('badge-status');
    let view: HTMLElement;

    if (screen === 'header') {
      badge.textContent = editingHeader ? 'Corrigindo cabeçalho' : 'Aguardando cabeçalho';
      view = headerScreen({
        editing: editingHeader ? data.header : null,
        lastSheet: data.lastSheet,
        canShare: shareSupported,
        onSubmit: submitHeader,
        onCancelEdit: () => { editingHeader = false; render(); },
        onDownloadLast: () => void deliverLastSheet('download'),
        onShareLast: () => void deliverLastSheet('share'),
      });
    } else if (screen === 'dashboard') {
      badge.textContent = `Turno ativo (${plural(data.ordens.length, 'OS', 'OSs')})`;
      view = dashboardScreen({
        header: data.header!,
        ordens: data.ordens,
        onStartOS: startOS,
        onView: viewOS,
        onEdit: (os) => setDraft(wiz.draftFromOS(os)),
        onDelete: deleteOS,
        onEditHeader: () => { editingHeader = true; render(); },
        onFinish: confirmFinish,
      });
    } else {
      const draft = data.draft!;
      badge.textContent = `Preenchendo OS ${draft.osNumber}`;
      view = wizardScreen({
        draft,
        onText: (v) => setDraft(wiz.setText(data.draft!, v), false),
        onChoice: (c) => {
          setDraft(wiz.setChoice(data.draft!, c));
          document.getElementById('wiz-detail-input')?.focus();
        },
        onDetail: (v) => setDraft(wiz.setDetail(data.draft!, v), false),
        onNext: () => step(wiz.next(data.draft!)),
        onSkip: () => step(wiz.skip(data.draft!)),
        onBack: () => setDraft(wiz.back(data.draft!)),
        onCancel: cancelWizard,
      });
    }

    root.replaceChildren(view);
    if (screen !== shownScreen) window.scrollTo({ top: 0, behavior: 'smooth' });
    shownScreen = screen;
    if (screen === 'wizard') document.getElementById('wiz-text-input')?.focus();
  }

  // --- Cabeçalho -----------------------------------------------------------

  function submitHeader(header: ShiftHeader): void {
    const wasEditing = editingHeader;
    editingHeader = false;
    update((d) => { d.header = header; });
    showToast(wasEditing ? 'Cabeçalho atualizado.' : 'Turno iniciado! Registro de OSs liberado.', 'success');
  }

  // --- Painel --------------------------------------------------------------

  function startOS(osNumber: string, type: ServiceType, code: string): void {
    if (!osNumber) {
      showToast('Digite o número da OS antes de escolher o código.', 'warning');
      document.getElementById('input-os-number')?.focus();
      return;
    }
    const begin = () => setDraft(wiz.startDraft(osNumber, type, code));
    if (data.ordens.some((os) => os.osNumber === osNumber)) {
      confirmModal(
        'OS já registrada',
        `A OS ${osNumber} já está nesta folha. Deseja registrar outro atendimento para ela?`,
        { label: 'Registrar mesmo assim', variant: 'primary' },
        begin,
      );
      return;
    }
    begin();
  }

  function viewOS(os: OrdemServico): void {
    const rows = wiz.answerRows(os).map((r, i) =>
      h(
        'div',
        { class: 'border-b border-slate-100 pb-2.5 last:border-none' },
        h('p', { class: 'text-xs font-bold text-slate-500' }, `${i + 1}. ${r.question}`),
        h('p', { class: `text-sm font-semibold mt-0.5 ${r.skipped ? 'text-slate-400 italic' : r.isDitais ? 'text-rose-700' : 'text-energisa-navy'}` }, r.display),
      ),
    );
    openModal(`OS ${os.osNumber} (${SERVICE_LABEL[os.serviceType]} - Cód. ${os.serviceCode})`, h('div', { class: 'space-y-3' }, rows), [
      { label: 'Editar', variant: 'neutral', onClick: () => { closeModal(); setDraft(wiz.draftFromOS(os)); } },
      { label: 'Fechar', variant: 'primary', onClick: closeModal },
    ]);
  }

  function deleteOS(os: OrdemServico): void {
    confirmModal(
      'Excluir Ordem de Serviço',
      `Tem certeza que deseja remover a OS ${os.osNumber} (código ${os.serviceCode}) desta folha?`,
      { label: 'Sim, excluir', variant: 'danger' },
      () => {
        update((d) => { d.ordens = d.ordens.filter((o) => o.id !== os.id); });
        showToast('Ordem de serviço removida.', 'info');
      },
    );
  }

  // --- Assistente ----------------------------------------------------------

  function step(result: wiz.StepResult): void {
    if (!result.ok) {
      showToast(result.error, 'warning');
      if (result.focus === 'detail') document.getElementById('wiz-detail-input')?.focus();
      return;
    }
    if (!result.done) {
      setDraft(result.draft);
      return;
    }
    const draft = result.draft;
    update((d) => {
      if (draft.editingId) {
        const id = draft.editingId;
        const original = d.ordens.find((o) => o.id === id);
        const updated = wiz.finalize(draft, id, original ? new Date(original.registradaEm) : new Date());
        d.ordens = d.ordens.map((o) => (o.id === id ? updated : o));
      } else {
        d.ordens = [...d.ordens, wiz.finalize(draft, newId(), new Date())];
      }
      d.draft = null;
    });
    showToast(draft.editingId ? `OS ${draft.osNumber} atualizada.` : `OS ${draft.osNumber} adicionada à folha de produção!`, 'success');
  }

  function cancelWizard(): void {
    const draft = data.draft!;
    confirmModal(
      draft.editingId ? 'Cancelar edição' : 'Cancelar registro da OS',
      draft.editingId
        ? `Descartar as alterações na OS ${draft.osNumber}? A versão salva é mantida.`
        : `Deseja cancelar o preenchimento da OS ${draft.osNumber}? As respostas desta OS não serão salvas.`,
      { label: draft.editingId ? 'Descartar alterações' : 'Descartar OS', variant: 'danger' },
      () => update((d) => { d.draft = null; }),
      'Continuar preenchendo',
    );
  }

  // --- Encerramento do turno e PDF ----------------------------------------

  function confirmFinish(): void {
    const n = data.ordens.length;
    const body =
      n === 0
        ? 'Nenhuma Ordem de Serviço foi registrada neste turno. Deseja gerar a folha em branco mesmo assim?'
        : h(
            'div',
            { class: 'space-y-2' },
            h('p', null, `Você está prestes a gerar o PDF oficial com ${plural(n, 'Ordem de Serviço', 'Ordens de Serviço')}.`),
            h('div', { class: 'bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 font-medium' }, 'Importante: a folha será encerrada e o sistema pedirá um novo cabeçalho. O PDF continua disponível para baixar ou compartilhar na tela inicial.'),
          );
    confirmModal(n === 0 ? 'Nenhuma OS registrada' : 'Finalizar turno e gerar PDF', body, { label: h('span', { class: 'flex items-center gap-2' }, icon(FileDown), 'Confirmar e gerar PDF'), variant: 'accent' }, () => void finishShift());
  }

  let finishing = false;

  async function finishShift(): Promise<void> {
    // Toque duplo no botão enquanto o jsPDF carrega não pode encerrar o turno duas vezes.
    if (finishing || !data.header) return;
    finishing = true;
    const sheet: ClosedSheet = { header: data.header, ordens: data.ordens, fechadaEm: new Date().toISOString() };
    let pdf: Awaited<ReturnType<typeof sheetPdf>>;
    try {
      pdf = await sheetPdf(sheet);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showToast('Erro ao gerar o PDF. Os dados do turno foram mantidos; tente novamente.', 'error');
      return;
    } finally {
      finishing = false;
    }

    // Só encerra o turno depois que o PDF foi gerado com sucesso.
    update((d) => {
      d.lastSheet = sheet;
      d.header = null;
      d.ordens = [];
      d.draft = null;
    });
    pdf.doc.save(pdf.fileName);

    const actions: ModalAction[] = [{ label: 'OK', variant: 'primary', onClick: closeModal }];
    if (shareSupported) {
      actions.unshift({
        label: h('span', { class: 'flex items-center gap-2' }, icon(Share2), 'Compartilhar'),
        variant: 'neutral',
        onClick: () => { closeModal(); void deliverLastSheet('share'); },
      });
    }
    openModal('Folha encerrada', h('p', null, `PDF "${pdf.fileName}" gerado. Se o download não aparecer, use "Baixar PDF" na tela inicial.`), actions);
  }

  async function deliverLastSheet(mode: 'download' | 'share'): Promise<void> {
    if (!data.lastSheet) return;
    try {
      const { doc, fileName } = await sheetPdf(data.lastSheet);
      if (mode === 'download') {
        doc.save(fileName);
        return;
      }
      const file = new File([doc.output('blob')], fileName, { type: 'application/pdf' });
      await navigator.share({ files: [file], title: 'Folha de Produção Diária' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return; // usuário fechou o compartilhamento
      console.error('Erro ao entregar PDF:', error);
      showToast('Não foi possível gerar ou compartilhar o PDF.', 'error');
    }
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeModal();
  });

  render();
}
