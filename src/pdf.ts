import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';
import { SERVICE_LABEL, TECNICOS_LIDERES } from './domain/catalog';
import { ESPELHO_MIN_LINHAS, espelhoRows } from './domain/espelho';
import { formatDateBR, formatHorario, orDash, osLabel } from './domain/format';
import type { OrdemServico, ShiftHeader } from './domain/types';
import { answerRows } from './domain/wizard';

type RGB = [number, number, number];

const NAVY: RGB = [15, 41, 74];
const BLUE: RGB = [0, 114, 206];
const GREEN: RGB = [16, 110, 75];
const ORANGE: RGB = [243, 112, 33];
const GRAY_LABEL: RGB = [230, 234, 240];
const LINE: RGB = [120, 130, 145];
const DITAIS_BG: RGB = [254, 242, 242];
const DITAIS_TEXT: RGB = [185, 28, 28];
const MUTED: RGB = [140, 140, 140];

// A4 paisagem: 297 x 210 mm, 277 mm úteis entre margens.
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = { top: 10, left: 10, right: 10, bottom: 12 };

const GRID = { font: 'helvetica', fontSize: 8, cellPadding: 1.8, lineColor: LINE, lineWidth: 0.25, textColor: [20, 20, 20] as RGB, valign: 'middle' as const };
const LABEL = { fontStyle: 'bold' as const, fillColor: GRAY_LABEL };

function finalY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function identificacao(doc: jsPDF, h: ShiftHeader): void {
  autoTable(doc, {
    startY: MARGIN.top,
    margin: MARGIN,
    theme: 'grid',
    styles: { ...GRID, overflow: 'ellipsize' },
    columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 72 }, 2: { cellWidth: 40 }, 3: { cellWidth: 45 }, 4: { cellWidth: 22 }, 5: { cellWidth: 30 }, 6: { cellWidth: 22 }, 7: { cellWidth: 28 } },
    body: [
      [
        { content: 'GRUPO ENERGISA', rowSpan: 2, colSpan: 2, styles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 13, halign: 'center' } },
        { content: 'DEPARTAMENTO DE OPERAÇÃO', colSpan: 6, styles: { fontStyle: 'bold', fontSize: 10, halign: 'center', fillColor: GRAY_LABEL } },
      ],
      [{ content: 'ESPELHO DE CAMPO', colSpan: 6, styles: { fontStyle: 'bold', fontSize: 12, halign: 'center', textColor: ORANGE } }],
      [
        { content: 'NOME:', styles: LABEL },
        orDash(h.nome1),
        `MAT: ${h.mat1}`,
        `EQUIPE: ${h.equipe}`,
        { content: 'DATA:', styles: LABEL },
        formatDateBR(h.data),
        { content: 'BODYCAM:', styles: LABEL },
        orDash(h.bodycam1),
      ],
      [
        { content: 'NOME:', styles: LABEL },
        orDash(h.nome2),
        `MAT: ${h.mat2}`,
        `VIATURA: ${h.viatura}`,
        { content: 'HORARIO:', styles: LABEL },
        formatHorario(h),
        { content: 'BODYCAM2:', styles: LABEL },
        orDash(h.bodycam2),
      ],
    ],
  });
}

function tabelaServicos(doc: jsPDF, ordens: readonly OrdemServico[]): void {
  const rows: RowInput[] = espelhoRows(ordens).map((r) => [
    r.item,
    r.os,
    r.tipo,
    r.medidorInstalado,
    r.leituraInstalado,
    r.medidorRetirado,
    r.leituraRetirado,
    r.desvios,
  ]);
  for (let i = rows.length; i < ESPELHO_MIN_LINHAS; i++) rows.push([i + 1, '', '', '', '', '', '', '']);

  autoTable(doc, {
    startY: finalY(doc) + 3,
    margin: MARGIN,
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    // Uma linha por OS (~5,7 mm): as 20 linhas + identificação + rodapé cabem numa folha A4 paisagem.
    // Texto longo é cortado com "..." aqui; a resposta completa está no detalhamento.
    styles: { ...GRID, cellPadding: 1.2, overflow: 'ellipsize' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 30 },
      2: { cellWidth: 58 },
      3: { cellWidth: 32 },
      4: { cellWidth: 22 },
      5: { cellWidth: 32 },
      6: { cellWidth: 22 },
      7: { cellWidth: 69 },
    },
    head: [['ITEM', 'OS/OCORRÊNCIA', 'TIPO DE SERVIÇO', 'MEDIDOR INSTALADO', 'LEITURA', 'MEDIDOR RETIRADO', 'LEITURA', 'INFORMAÇÕES DESVIOS']],
    body: rows,
  });
}

function rodapeEspelho(doc: jsPDF, h: ShiftHeader, total: number): void {
  autoTable(doc, {
    startY: finalY(doc) + 3,
    margin: MARGIN,
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: GRID,
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 74 }, 2: { cellWidth: 74 }, 3: { cellWidth: 74 } },
    body: [
      [{ content: 'TEC.LIDER RESPONSAVEL PELA EQUIPE', colSpan: 4, styles: { ...LABEL, halign: 'center' } }],
      [
        { content: `PRODUÇÃO TOTAL: ${total}`, styles: { fontStyle: 'bold' } },
        ...TECNICOS_LIDERES.map((lider) => ({
          content: `[${lider === h.lider ? 'X' : ' '}] ${lider}`,
          styles: { fontStyle: lider === h.lider ? ('bold' as const) : ('normal' as const) },
        })),
      ],
    ],
  });
}

/** Anexo: todas as respostas de cada OS (DITAIS, KM, horários...), que não têm coluna no espelho. */
function detalhamento(doc: jsPDF, ordens: readonly OrdemServico[]): void {
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('DETALHAMENTO DAS ORDENS DE SERVIÇO', MARGIN.left, MARGIN.top + 4);
  let y = MARGIN.top + 8;

  ordens.forEach((os, idx) => {
    autoTable(doc, {
      startY: y,
      margin: MARGIN,
      theme: 'grid',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      head: [[{
        content: `ITEM ${idx + 1}  |  OS: ${osLabel(os.osNumber)}  |  TIPO: ${SERVICE_LABEL[os.serviceType]} (CÓDIGO ${os.serviceCode})`,
        colSpan: 2,
        styles: { fillColor: os.serviceType === 'COMERCIAL' ? GREEN : BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      }]],
      body: answerRows(os).map((row, qIdx) => [
        {
          content: `${qIdx + 1}. ${row.question}`,
          styles: { cellWidth: 140, fontStyle: row.isDitais ? 'bold' : 'normal', fillColor: row.isDitais ? DITAIS_BG : [250, 251, 252] },
        },
        {
          content: row.display,
          styles: {
            fontStyle: row.skipped ? 'italic' : 'bold',
            textColor: row.skipped ? MUTED : row.isDitais ? DITAIS_TEXT : NAVY,
            fillColor: row.isDitais ? DITAIS_BG : [255, 255, 255],
          },
        },
      ]),
      styles: { ...GRID, lineColor: [200, 208, 218], lineWidth: 0.2 },
    });
    y = finalY(doc) + 4;
  });
}

export function newSheetDoc(): jsPDF {
  return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
}

/** Desenha o Espelho de Campo (identificação, tabela de serviços e rodapé) a partir da página atual. */
export function drawEspelho(doc: jsPDF, header: ShiftHeader, ordens: readonly OrdemServico[]): void {
  identificacao(doc, header);
  tabelaServicos(doc, ordens);
  rodapeEspelho(doc, header, ordens.length);
}

/** Monta o PDF do Espelho de Campo (A4 paisagem) seguido do detalhamento das OSs. */
export function buildSheetPdf(header: ShiftHeader, ordens: readonly OrdemServico[], emitidoEm: Date): jsPDF {
  const doc = newSheetDoc();

  drawEspelho(doc, header, ordens);
  if (ordens.length > 0) detalhamento(doc, ordens);

  const emitido = emitidoEm.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const data = formatDateBR(header.data);
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Grupo Energisa - Espelho de Campo | Equipe: ${header.nome1} | Data: ${data} | Emitido em ${emitido} | Página ${i} de ${totalPages}`,
      PAGE_W / 2,
      PAGE_H - 5,
      { align: 'center' },
    );
  }

  return doc;
}
