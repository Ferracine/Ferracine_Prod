import { jsPDF } from 'jspdf';
import { autoTable, type CellHookData, type RowInput, type UserOptions } from 'jspdf-autotable';
import logoPng from './assets/energisa-pdf.png?inline';
import { TECNICOS_LIDERES } from './domain/catalog';
import { espelhoRows } from './domain/espelho';
import { formatDateBR, formatHorario } from './domain/format';
import type { OrdemServico, ShiftHeader } from './domain/types';

/**
 * Espelho de Campo idêntico à folha de papel (design/ex_pdf.jpeg): A4 paisagem, preto e branco, um bloco
 * contínuo de tabelas. As larguras das colunas foram medidas na foto e somam a largura útil (281 mm) em cada tabela.
 */

type RGB = [number, number, number];
const BLACK: RGB = [0, 0, 0];
const MARGIN = { top: 10, left: 8, right: 8, bottom: 8 };
const LARGURA_UTIL = 297 - MARGIN.left - MARGIN.right;
/** Linhas impressas na folha, como no papel; com mais OSs a tabela continua na folha seguinte. */
const LINHAS_FOLHA = 15;
const FONT = 'helvetica';

const BASE: UserOptions['styles'] = {
  font: FONT,
  fontSize: 8,
  textColor: BLACK,
  lineColor: BLACK,
  lineWidth: 0.3,
  cellPadding: 1,
  valign: 'middle',
  // Nada é cortado: o PDF é o único registro das respostas, então texto longo quebra linha.
  overflow: 'linebreak',
};
const LABEL = { fontStyle: 'bold' as const, fontSize: 7 };

function finalY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** Tabela "grudada" na anterior, como na folha (sem espaço entre os blocos). */
function block(doc: jsPDF, options: UserOptions, startY = finalY(doc)): void {
  autoTable(doc, { startY, margin: MARGIN, theme: 'grid', styles: BASE, tableWidth: LARGURA_UTIL, ...options });
}

function pen(doc: jsPDF, size: number, bold = true): void {
  doc.setFont(FONT, bold ? 'bold' : 'normal');
  doc.setFontSize(size);
}

/** Logo à esquerda (ocupando duas linhas) + DEPARTAMENTO DE OPERAÇÃO / ESPELHO DE CAMPO. */
function titulo(doc: jsPDF): void {
  // Linhas um pouco mais altas que na folha para o logo (mais "quadrado" que o impresso) ocupar a célula.
  const title = { fontStyle: 'bold' as const, fontSize: 7.5, halign: 'center' as const, minCellHeight: 6.8 };
  const logo = doc.getImageProperties(logoPng);
  const ratio = logo.width / logo.height;
  block(
    doc,
    {
      columnStyles: { 0: { cellWidth: 52.7 }, 1: { cellWidth: 228.3 } },
      body: [
        [{ content: '', rowSpan: 2 }, { content: 'DEPARTAMENTO DE OPERAÇÃO', styles: title }],
        [{ content: 'ESPELHO DE CAMPO', styles: title }],
      ],
      didDrawCell: ({ cell, column, row, section }: CellHookData) => {
        if (section !== 'body' || column.index !== 0 || row.index !== 0) return;
        const w = Math.min((cell.height - 1.6) * ratio, cell.width - 3);
        const h = w / ratio;
        doc.addImage(logoPng, 'PNG', cell.x + (cell.width - w) / 2, cell.y + (cell.height - h) / 2, w, h);
      },
    },
    MARGIN.top,
  );
}

/** NOME / MAT / EQUIPE|VIATURA / DATA|HORARIO / BODYCAM|BODYCAM2, rótulo e valor lado a lado. */
function identificacao(doc: jsPDF, h: ShiftHeader): void {
  const linha = (...pares: [string, string][]): RowInput =>
    pares.flatMap(([rotulo, valor]) => [
      { content: rotulo, styles: LABEL },
      { content: valor, styles: { fontSize: 9 } },
    ]);
  block(doc, {
    styles: { ...BASE, minCellHeight: 6 },
    columnStyles: { 0: { cellWidth: 11 }, 1: { cellWidth: 62 }, 2: { cellWidth: 9 }, 3: { cellWidth: 36 }, 4: { cellWidth: 15 }, 5: { cellWidth: 19 }, 6: { cellWidth: 16 }, 7: { cellWidth: 31 }, 8: { cellWidth: 18 }, 9: { cellWidth: 64 } },
    body: [
      linha(['NOME:', h.nome1], ['MAT:', h.mat1], ['EQUIPE:', h.equipe], ['DATA:', formatDateBR(h.data)], ['BODYCAM:', h.bodycam1]),
      linha(['NOME:', h.nome2], ['MAT:', h.mat2], ['VIATURA:', h.viatura], ['HORARIO:', formatHorario(h)], ['BODYCAM2:', h.bodycam2]),
    ],
  });
}

/** ITEM (vertical) | OS/OCORRÊNCIA | TIPO DE SERVIÇO | MEDIDOR INSTALADO | LEITURA | MEDIDOR RETIRADO | LEITURA | INFO ADICIONAL */
function tabelaServicos(doc: jsPDF, ordens: readonly OrdemServico[]): void {
  const rows: RowInput[] = espelhoRows(ordens).map((r) => [r.item, r.os, r.tipo, r.medidorInstalado, r.leituraInstalado, r.medidorRetirado, r.leituraRetirado, r.info]);
  for (let i = rows.length; i < LINHAS_FOLHA; i++) rows.push([i + 1, '', '', '', '', '', '', '']);

  block(doc, {
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { ...BASE, fontSize: 9, minCellHeight: 7.6 },
    // Pouco espaçamento: "LEITURA" cabe na coluna estreita (11 mm) como na folha.
    headStyles: { fillColor: false, fontStyle: 'bold', fontSize: 6.5, halign: 'center', minCellHeight: 6.7, cellPadding: 0.4 },
    columnStyles: {
      0: { cellWidth: 4.7, halign: 'center', fontStyle: 'bold', fontSize: 7, cellPadding: 0.3 },
      1: { cellWidth: 48 },
      2: { cellWidth: 33.3 },
      3: { cellWidth: 52.5 },
      // LEITURA é estreita como na folha: fonte menor para caber leitura de 6-7 dígitos numa linha.
      4: { cellWidth: 11.4, fontSize: 7, cellPadding: 0.5 },
      5: { cellWidth: 46.2 },
      6: { cellWidth: 11.2, fontSize: 7, cellPadding: 0.5 },
      // Tudo o que o eletricista respondeu sem coluna própria, em fonte pequena para a folha caber 15 OSs.
      7: { cellWidth: 73.7, fontSize: 6, cellPadding: { top: 0.6, bottom: 0.6, left: 1, right: 1 } },
    },
    head: [['', 'OS/OCORRÊNCIA', 'TIPO DE SERVIÇO', 'MEDIDOR INSTALADO', 'LEITURA', 'MEDIDOR RETIRADO', 'LEITURA', 'INFO ADICIONAL']],
    body: rows,
    didDrawCell: ({ cell, column, section }: CellHookData) => {
      if (section !== 'head' || column.index !== 0) return;
      pen(doc, 6);
      doc.text('ITEM', cell.x + cell.width / 2 + 1, cell.y + cell.height - 0.8, { angle: 90 });
    },
  });
}

/** Separa "TEC. NOME - 69 99999-9999" em nome e telefone. */
function splitLider(lider: string): [string, string] {
  const i = lider.lastIndexOf(' - ');
  return i < 0 ? [lider, ''] : [lider.slice(0, i), lider.slice(i + 3)];
}

/** TEC.LIDER RESPONSAVEL PELA EQUIPE + PRODUÇÃO TOTAL e os técnicos com o quadradinho de marcar. */
function rodape(doc: jsPDF, h: ShiftHeader, total: number): void {
  block(doc, {
    // As duas linhas do rodapé ficam sempre juntas: se não couberem, vão inteiras para a folha seguinte.
    pageBreak: 'avoid',
    columnStyles: { 0: { cellWidth: 53.7 }, 1: { cellWidth: 65.4 }, 2: { cellWidth: 77 }, 3: { cellWidth: 84.9 } },
    body: [
      [{ content: 'TEC.LIDER RESPONSAVEL PELA EQUIPE', colSpan: 4, styles: { ...LABEL, fontSize: 7.5, halign: 'center', minCellHeight: 5 } }],
      [{ content: '', styles: { minCellHeight: 16 } }, '', '', ''],
    ],
    didDrawCell: ({ cell, column, row, section }: CellHookData) => {
      if (section !== 'body' || row.index !== 1) return;
      if (column.index === 0) {
        const label = 'PRODUÇÃO TOTAL:';
        const x = cell.x + 4;
        const y = cell.y + cell.height / 2;
        pen(doc, 7.5);
        doc.text(label, x, y);
        doc.setLineWidth(0.3);
        doc.line(x, y + 0.8, x + doc.getTextWidth(label), y + 0.8);
        pen(doc, 12);
        doc.text(String(total), x + 4, cell.y + cell.height - 2);
        return;
      }
      const lider = TECNICOS_LIDERES[column.index - 1];
      if (!lider) return;
      const [nome, telefone] = splitLider(lider);
      const cx = cell.x + cell.width / 2;
      pen(doc, 7.5);
      doc.text(nome, cx, cell.y + 5, { align: 'center' });
      pen(doc, 7);
      doc.text(telefone, cx, cell.y + 9.5, { align: 'center' });
      // Quadradinho de marcar no canto inferior esquerdo; com X no técnico escolhido.
      const box = { x: cell.x + 4, y: cell.y + cell.height - 6, s: 3.6 };
      doc.setLineWidth(0.35);
      doc.rect(box.x, box.y, box.s, box.s);
      if (lider === h.lider) {
        doc.setLineWidth(0.5);
        doc.line(box.x + 0.6, box.y + 0.6, box.x + box.s - 0.6, box.y + box.s - 0.6);
        doc.line(box.x + box.s - 0.6, box.y + 0.6, box.x + 0.6, box.y + box.s - 0.6);
      }
    },
  });
}

/** PDF do Espelho de Campo (A4 paisagem), idêntico ao modelo de papel. */
export function buildSheetPdf(header: ShiftHeader, ordens: readonly OrdemServico[]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  titulo(doc);
  identificacao(doc, header);
  tabelaServicos(doc, ordens);
  rodape(doc, header, ordens.length);
  return doc;
}
