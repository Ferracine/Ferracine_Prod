import { History } from 'lucide';
import { SERVICE_LABEL } from './domain/catalog';
import { osLabel, plural, sheetFileName, sheetLabel } from './domain/format';
import * as ordem from './domain/ordem';
import { SHEETS_KEPT, type AppData, type ClosedSheet, type OrdemServico, type OSDraft, type ShiftHeader } from './domain/types';
import { androidBridge, blobToBase64, SAVED_PREFIX } from './platform';
import { encerrarDados, type KeyValueStore, loadData, reabrirDados, removerFolha, saveData } from './storage';
import { dashboardScreen } from './ui/dashboard-screen';
import { botaoDoTopo, byId, CALLOUT, h, marcarFaltando } from './ui/dom';
import { closeModal, confirmModal, isModalOpen, openModal, showToast } from './ui/feedback';
import { type AcaoFolha, type FolhasProps, listaFolhas } from './ui/folhas';
import { headerScreen, sheetsCard } from './ui/header-screen';
import { osScreen } from './ui/os-screen';

/** `new` = OS nova em preenchimento (rascunho salvo); `edit` = lápis de uma OS concluída. Mesma tela da OS. */
type Screen = 'header' | 'dashboard' | 'new' | 'edit';
type PdfModule = typeof import('./pdf');
/** PDF pronto: baixar, abrir e compartilhar reaproveitam o mesmo Blob (e, no APK, o base64). */
type Arquivo = { blob: Blob; fileName: string; mime: string; base64?: string };
const PDF_MIME = 'application/pdf';

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
// jsPDF só é carregado quando o PDF é pedido no histórico (pré-carregado na tela inicial com folhas e ao abrir o
// histórico do topo, para Abrir/Compartilhar agirem logo após o toque).

let pdfModule: PdfModule | null = null;
let pdfModuleLoading: Promise<PdfModule> | null = null;

function loadPdfModule(): Promise<PdfModule> {
  pdfModuleLoading ??= import('./pdf').then((mod) => (pdfModule = mod));
  return pdfModuleLoading;
}

/** PDF já montado de cada folha do histórico: baixar, abrir e compartilhar a mesma folha não remonta o jsPDF. */
const pdfMemo = new WeakMap<ClosedSheet, Arquivo>();

function buildPdf(mod: PdfModule, sheet: ClosedSheet): Arquivo {
  const memo = pdfMemo.get(sheet);
  if (memo) return memo;
  const doc = mod.buildSheetPdf(sheet.header, sheet.ordens, sheet.tecnicos);
  const pdf = { blob: doc.output('blob'), fileName: sheetFileName(sheet.header, sheet.ordens.length), mime: PDF_MIME };
  pdfMemo.set(sheet, pdf);
  return pdf;
}

/** No APK, entrega o arquivo ao código nativo: null = sem a ponte (navegador); senão, se deu certo. */
async function viaAndroid(action: 'saveFile' | 'openFile' | 'shareFile', arquivo: Arquivo): Promise<boolean | null> {
  if (!androidBridge) return null;
  arquivo.base64 ??= await blobToBase64(arquivo.blob);
  const r = androidBridge[action](arquivo.base64, arquivo.fileName, arquivo.mime);
  // saveFile: "salvo:<nome que ficou em Downloads>"; os outros: "" quando dá certo. Senão, a mensagem de erro.
  if (r.startsWith(SAVED_PREFIX)) showToast(`Salvo em Downloads: ${r.slice(SAVED_PREFIX.length)}`, 'success');
  else if (r) showToast(r, 'error');
  return !r || r.startsWith(SAVED_PREFIX);
}

/** Devolvem true quando o PDF saiu (baixado/compartilhado). */
async function downloadFile(pdf: Arquivo): Promise<boolean> {
  const nativo = await viaAndroid('saveFile', pdf);
  if (nativo !== null) return nativo;
  const url = URL.createObjectURL(pdf.blob);
  const a = h('a', { href: url, download: pdf.fileName, class: 'hidden' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

async function openFile(pdf: Arquivo): Promise<boolean> {
  const nativo = await viaAndroid('openFile', pdf);
  if (nativo !== null) return nativo;
  const url = URL.createObjectURL(pdf.blob);
  const aberto = !!window.open(url, '_blank');
  if (!aberto) showToast('O navegador bloqueou a abertura. Use "Baixar PDF" ou "Compartilhar".', 'warning');
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return aberto;
}

async function shareFile(pdf: Arquivo): Promise<boolean> {
  const nativo = await viaAndroid('shareFile', pdf);
  if (nativo !== null) return nativo;
  try {
    const file = new File([pdf.blob], pdf.fileName, { type: pdf.mime });
    await navigator.share({ files: [file], title: pdf.fileName });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false; // usuário fechou o compartilhamento
    console.error('Erro ao compartilhar PDF:', error);
    showToast('Não foi possível compartilhar. Use "Baixar PDF".', 'warning');
    return false;
  }
}

export function startApp(root: HTMLElement, store: KeyValueStore): void {
  let data: AppData = loadData(store);
  let editingHeader = false;
  /** OS aberta na tela de edição (lápis). Só em memória: a OS salva muda apenas em "Salvar alterações". */
  let editing: { os: OrdemServico; dirty: boolean } | null = null;
  let shownScreen: Screen | null = null;
  /** O turno aberto veio de uma folha reaberta: corrigir o cabeçalho dela não muda o "próximo turno" (lastHeader). */
  let turnoReaberto = false;
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
      badge.textContent = editingHeader ? 'Editando cabeçalho' : 'Aguardando cabeçalho';
      view = headerScreen({
        editing: editingHeader ? data.header : null,
        defaults: data.lastHeader,
        getTecnicos: () => data.tecnicos,
        onAddTecnico: (nome, telefone) => update((d) => { d.tecnicos = [...d.tecnicos, { id: newId(), nome, telefone }]; }, false),
        // Um líder excluído deixa de aparecer: o seletor cai em "—" e o PDF não marca ninguém (id desconhecido é ignorado).
        onRemoveTecnico: (id) => update((d) => { d.tecnicos = d.tecnicos.filter((t) => t.id !== id); }, false),
        getEletricistas: () => data.eletricistas,
        onAddEletricista: (nome, matricula) => update((d) => { d.eletricistas = [...d.eletricistas, { id: newId(), nome, matricula }]; }, false),
        onRemoveEletricista: (id) => update((d) => { d.eletricistas = d.eletricistas.filter((e) => e.id !== id); }, false),
        folhas: folhasProps(),
        onSubmit: submitHeader,
        onCancelEdit: cancelHeaderEdit,
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
        onFinish: encerrarTurno,
      });
    }

    root.replaceChildren(view);
    if (screen !== shownScreen) window.scrollTo({ top: 0, behavior: 'smooth' });
    shownScreen = screen;
    syncBackButton(screen);
    // Abrir/Compartilhar precisam agir logo após o toque: na tela inicial com folhas, deixa o jsPDF carregado em segundo
    // plano (a janela do histórico do topo carrega ao abrir).
    if (!pdfModuleLoading && screen === 'header' && !editingHeader && data.sheets.length) {
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

  /** Nomes, matrículas, equipe, viatura e bodycams em maiúsculas (data, horários e o id do líder ficam como estão). */
  const CABECALHO_TEXTO = ['nome1', 'mat1', 'nome2', 'mat2', 'equipe', 'viatura', 'bodycam1', 'bodycam2'] as const;

  function submitHeader(raw: ShiftHeader): void {
    const header = { ...raw };
    for (const k of CABECALHO_TEXTO) header[k] = header[k].toUpperCase();
    const wasEditing = editingHeader;
    editingHeader = false;
    update((d) => {
      d.header = header;
      if (!turnoReaberto) d.lastHeader = header; // preenche o próximo turno
    });
    showToast(wasEditing ? 'Cabeçalho atualizado.' : 'Turno iniciado! Registro de OSs liberado.', 'success');
  }

  // --- Painel --------------------------------------------------------------

  function viewOS(os: OrdemServico): void {
    const rows = ordem.answerRows(os).map((r, i) =>
      h(
        'div',
        { class: 'border-b border-fg/10 pb-2.5 last:border-none' },
        h('p', { class: 'text-xs font-bold text-muted' }, `${i + 1}. ${r.question}`),
        h('p', { class: `text-sm font-semibold mt-0.5 ${r.isDitais ? 'text-danger-fg' : r.skipped ? 'text-subtle' : 'text-fg'}${r.skipped ? ' italic' : ''}` }, r.display),
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

  /** Regra não cumprida (código, DITAIS): avisa e rola até o campo. */
  function showRuleError(result: ordem.RuleError): void {
    showToast(result.error, 'warning');
    const field = document.querySelector(`[data-field="${result.field}"]`);
    // Pergunta: o cartão inteiro fica vermelho; código (ou outro campo solto): a caixa do campo.
    marcarFaltando(field?.matches('.card') ? field : (field?.querySelector('.field') ?? field));
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

  function cancelHeaderEdit(): void {
    editingHeader = false;
    render();
  }

  // Botão/gesto "voltar" do Android: na tela da OS (nova ou edição) e na correção do cabeçalho ele faz o mesmo que o
  // Cancelar da tela (em vez de fechar o app). Uma entrada extra no histórico "segura" o voltar enquanto essas telas
  // estão abertas. Depois de recarregar, a entrada da sessão anterior ainda é a atual: reaproveita em vez de empilhar.
  let backTrap = (history.state as { ferracineBackTrap?: boolean } | null)?.ferracineBackTrap === true;
  // history.back() é assíncrono: o popstate dele chega depois. Enquanto não chega, não empilha outra entrada (abrir
  // outra OS logo depois de salvar faria esse popstate atrasado "cancelar" a OS nova).
  let backPendente = 0;
  const trapsBack = (screen: Screen) => screen === 'new' || screen === 'edit' || (screen === 'header' && editingHeader);

  function syncBackButton(screen: Screen): void {
    if (backPendente > 0) return; // o popstate pendente chama de novo
    if (trapsBack(screen) && !backTrap) {
      history.pushState({ ferracineBackTrap: true }, '');
      backTrap = true;
    } else if (!trapsBack(screen) && backTrap) {
      backTrap = false;
      backPendente++;
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
    if (backPendente > 0) {
      backPendente--;
      syncBackButton(currentScreen()); // se já abriu outra tela que segura o voltar, empilha agora
      return;
    }
    if (!backTrap) return;
    backTrap = false;
    const screen = currentScreen();
    if (isModalOpen()) closeModal();
    else if (screen === 'edit') cancelEdit();
    else if (screen === 'header') cancelHeaderEdit();
    else cancelNew();
    syncBackButton(currentScreen()); // ainda na tela: segura o próximo voltar
  });

  // --- PDF e encerramento do turno ----------------------------------------

  /**
   * "Encerrar turno": encerra num toque, sem gerar nem baixar o PDF (só pelo Baixar do histórico). Pergunta antes só
   * se houver o que conferir (nenhuma OS, OS sem número ou sem DITAIS, sem técnico líder, ou uma folha ainda não
   * baixada que sairia do histórico); a folha encerrada pode ser reaberta depois pelo "Editar" do histórico.
   */
  function encerrarTurno(): void {
    const n = data.ordens.length;
    const { semNumero, semDitais } = ordem.pendencias(data.ordens);
    const sai = data.sheets.length >= SHEETS_KEPT ? data.sheets[SHEETS_KEPT - 1] : undefined;
    const pendencias = [
      n === 0 && 'Nenhuma OS registrada: a folha sai em branco.',
      semNumero > 0 && `${plural(semNumero, 'OS está', 'OSs estão')} sem número (S/N).`,
      semDitais > 0 && `${plural(semDitais, 'OS está', 'OSs estão')} sem a resposta dos DITAIS (obrigatória).`,
      !data.tecnicos.some((t) => t.id === data.header?.lider) && 'Sem técnico líder: use "Editar" no cabeçalho para escolher.',
      sai && !sai.baixadaEm && `A folha de ${sheetLabel(sai)} não foi baixada e sai do histórico ao encerrar: baixe antes, se precisar.`,
    ].filter((p): p is string => !!p);
    if (!pendencias.length) {
      encerrar();
      return;
    }
    confirmModal(
      'Conferir antes de encerrar',
      h('div', { class: 'space-y-3' }, pendencias.map((p) => h('div', { class: CALLOUT.danger }, p)), h('p', null, 'Corrija o que precisar, ou encerre assim mesmo.')),
      { label: 'Encerrar mesmo assim', variant: 'accent' },
      encerrar,
      'Voltar e corrigir',
    );
  }

  /** A folha vai para o topo do histórico com "PDF não baixado" até o eletricista baixar (`encerrarDados`). */
  function encerrar(): void {
    turnoReaberto = false;
    update((d) => encerrarDados(d, new Date().toISOString()));
    showToast('Turno encerrado. A folha está nas últimas encerradas: toque em "Baixar PDF" para salvar.', 'success');
  }

  /** Folhas sendo entregues agora: toque duplo na mesma entrega uma vez só; as outras folhas seguem livres. */
  const delivering = new Set<ClosedSheet>();

  /** Baixa, abre ou compartilha o PDF de uma folha. */
  async function deliverSheet(sheet: ClosedSheet, mode: 'download' | 'open' | 'share'): Promise<void> {
    if (delivering.has(sheet)) return;
    delivering.add(sheet);
    try {
      // Com o módulo já carregado, monta na hora (síncrono) e o compartilhamento ainda conta como resposta ao toque.
      const pdf = buildPdf(pdfModule ?? (await loadPdfModule()), sheet);
      const saiu = await { download: downloadFile, open: openFile, share: shareFile }[mode](pdf);
      // Baixado ou compartilhado: some o "PDF não baixado" (abrir só para ver não conta).
      if (saiu && mode !== 'open' && !sheet.baixadaEm) {
        update(() => {
          sheet.baixadaEm = new Date().toISOString();
        }, false);
        atualizarListasDeFolhas();
      }
    } catch (error) {
      console.error('Erro ao gerar o PDF:', error);
      showToast('Não foi possível gerar o PDF.', 'error');
    } finally {
      delivering.delete(sheet);
    }
  }

  /** Histórico das últimas folhas, com as ações de cada uma (cartão da tela do cabeçalho e janela do topo). */
  /** `naJanela`: a lista está na janela do botão do topo (depois de excluir, a janela volta com a lista). */
  function folhasProps(naJanela = false): FolhasProps {
    return { sheets: data.sheets, canShare: shareSupported, turnoAberto: !!data.header, onAcao: (sheet, acao) => acaoFolha(sheet, acao, naJanela) };
  }

  function abrirHistorico(): void {
    void loadPdfModule().catch(() => undefined); // Abrir/Compartilhar logo após o toque precisam do gerador pronto
    openModal('Últimas folhas encerradas', listaFolhas(folhasProps(true)), [{ label: 'Fechar', variant: 'neutral', onClick: closeModal }]);
  }

  function acaoFolha(sheet: ClosedSheet, acao: AcaoFolha, naJanela: boolean): void {
    if (acao === 'edit') reabrirFolha(sheet);
    else if (acao === 'delete') excluirFolha(sheet, naJanela);
    else void deliverSheet(sheet, acao);
  }

  /**
   * "Editar": a folha volta a ser o turno aberto (cabeçalho e OSs) e sai do histórico; ao encerrar, a folha corrigida
   * volta ao topo do histórico.
   * Os técnicos da folha voltam ao cadastro (o líder dela continua valendo, mesmo se tinha sido excluído).
   */
  function reabrirFolha(sheet: ClosedSheet): void {
    if (data.header) return; // com turno aberto o botão já vem desativado, com o aviso
    confirmModal(
      'Editar folha encerrada',
      `A folha de ${sheetLabel(sheet)} volta a ser o turno aberto para você corrigir; ao encerrar, a folha corrigida volta ao histórico. O que estiver preenchido nesta tela é descartado.`,
      { label: 'Editar folha', variant: 'primary' },
      () => {
        turnoReaberto = true;
        update((d) => {
          reabrirDados(d, sheet);
          d.tecnicos = [...d.tecnicos, ...sheet.tecnicos.filter((t) => !d.tecnicos.some((x) => x.id === t.id))];
        });
        showToast('Folha reaberta: corrija o que precisar e toque em "Encerrar turno".', 'info');
      },
    );
  }

  /** Troca só as listas de folhas na tela (cartão da tela inicial e janela do topo): redesenhar perderia o digitado. */
  function atualizarListasDeFolhas(): void {
    const cartao = document.querySelector('[data-testid="last-sheets"]');
    if (data.sheets.length) cartao?.replaceWith(sheetsCard(folhasProps()));
    else cartao?.remove();
    document.querySelector('[role="dialog"] [data-lista="folhas"]')?.replaceWith(listaFolhas(folhasProps(true)));
  }

  /** Não redesenha a tela (perderia o que estiver sendo digitado). */
  function excluirFolha(sheet: ClosedSheet, naJanela: boolean): void {
    confirmModal(
      'Excluir folha',
      `Excluir a folha de ${sheetLabel(sheet)} do histórico? O PDF já baixado no celular não é apagado.`,
      { label: 'Excluir', variant: 'danger' },
      () => {
        update((d) => {
          d.sheets = removerFolha(d.sheets, sheet);
        }, false);
        atualizarListasDeFolhas();
        showToast('Folha excluída do histórico.', 'success');
        if (naJanela) abrirHistorico();
      },
    );
  }

  // Botão do topo (ao lado do tema): o histórico a qualquer momento, também com o turno aberto.
  botaoDoTopo(byId('historico-toggle'), History, 'Últimas folhas encerradas', abrirHistorico);

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeModal();
  });

  render();
}
