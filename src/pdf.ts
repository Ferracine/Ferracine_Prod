import { jsPDF } from 'jspdf';
import { autoTable, type CellHookData, type RowInput, type UserOptions } from 'jspdf-autotable';
import logoPng from './assets/energisa-pdf.png?inline';
import { type EspelhoRow, espelhoRows } from './domain/espelho';
import { formatDateBR, formatHorario } from './domain/format';
import type { OrdemServico, ShiftHeader, Tecnico } from './domain/types';

/**
 * Espelho de Campo idêntico à folha de papel (design/ex_pdf.jpeg): A4 paisagem, preto e branco, um bloco
 * contínuo de tabelas. As larguras das colunas foram medidas na foto e somam a largura útil (281 mm) em cada tabela.
 * Logo e identificação só na primeira folha (é um documento só); toda folha leva data, equipe e "FOLHA n/N" embaixo.
 */

type RGB = [number, number, number];
const BLACK: RGB = [0, 0, 0];
const MARGIN = { top: 10, left: 8, right: 8, bottom: 8 };
const LARGURA_UTIL = 297 - MARGIN.left - MARGIN.right;
/** Linhas de cada folha, como no papel; a 16ª OS abre uma folha nova, que continua a tabela. */
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

/** Quadradinho de marcar com X opcional (rodapé e coluna CLIENTE PRESENTE). */
function checkbox(doc: jsPDF, x: number, y: number, size: number, marked: boolean): void {
  doc.setLineWidth(0.3);
  doc.rect(x, y, size, size);
  if (!marked) return;
  const p = size * 0.18;
  doc.setLineWidth(0.45);
  doc.line(x + p, y + p, x + size - p, y + size - p);
  doc.line(x + size - p, y + p, x + p, y + size - p);
}

const HEAD = ['', 'OS/OCORRÊNCIA', 'TIPO DE SERVIÇO', 'KM INICIAL', 'HORÁRIO INICIAL', 'HORÁRIO FINAL', 'KM FINAL', 'MEDIDOR INSTALADO', 'LEITURA', 'MEDIDOR RETIRADO', 'LEITURA', 'CLIENTE PRESENTE', 'INFO ADICIONAL'];
const COL_CLIENTE = HEAD.indexOf('CLIENTE PRESENTE');

/**
 * ITEM (vertical) | OS/OCORRÊNCIA | TIPO DE SERVIÇO (código) | KM INICIAL | HORÁRIO INICIAL | HORÁRIO FINAL | KM FINAL |
 * MEDIDOR INSTALADO | LEITURA | MEDIDOR RETIRADO | LEITURA | CLIENTE PRESENTE (SIM/NÃO) | INFO ADICIONAL
 */
function tabelaServicos(doc: jsPDF, linhas: readonly EspelhoRow[], primeiroItem: number, startY?: number): void {
  const rows: RowInput[] = linhas.map((r) => [
    r.item, r.os, r.codigo, r.kmIni, r.horaIni, r.horaFin, r.kmFin,
    r.medidorInstalado, r.leituraInstalado, r.medidorRetirado, r.leituraRetirado, '', r.info,
  ]);
  // A folha sai sempre com 15 linhas; as que sobram ficam em branco, com a numeração seguindo a das OSs.
  for (let i = rows.length; i < LINHAS_FOLHA; i++) rows.push([primeiroItem + i, ...Array<string>(HEAD.length - 1).fill('')]);
  const narrow = { fontSize: 7.5, cellPadding: 0.6 };

  block(doc, {
    ...(startY === undefined ? {} : { startY }),
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { ...BASE, fontSize: 9, minCellHeight: 7.6 },
    // Pouco espaçamento no cabeçalho: os títulos quebram em duas linhas nas colunas estreitas, como na folha.
    headStyles: { fillColor: false, fontStyle: 'bold', fontSize: 6.5, halign: 'center', minCellHeight: 6.7, cellPadding: 0.4 },
    columnStyles: {
      0: { cellWidth: 4.7, halign: 'center', fontStyle: 'bold', fontSize: 7, cellPadding: 0.3 },
      1: { cellWidth: 28 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 14, ...narrow },
      4: { cellWidth: 12.5, ...narrow, halign: 'center' },
      5: { cellWidth: 12.5, ...narrow, halign: 'center' },
      6: { cellWidth: 14, ...narrow },
      7: { cellWidth: 24, ...narrow },
      8: { cellWidth: 13, ...narrow },
      9: { cellWidth: 24, ...narrow },
      10: { cellWidth: 13, ...narrow },
      [COL_CLIENTE]: { cellWidth: 17 },
      // Tudo o que o eletricista respondeu sem coluna própria, em fonte pequena para a folha caber 15 OSs.
      12: { cellWidth: 89.3, fontSize: 6, cellPadding: { top: 0.6, bottom: 0.6, left: 1, right: 1 } },
    },
    head: [HEAD],
    body: rows,
    didDrawCell: ({ cell, column, row, section }: CellHookData) => {
      if (section === 'head' && column.index === 0) {
        pen(doc, 6);
        doc.text('ITEM', cell.x + cell.width / 2 + 1, cell.y + cell.height - 0.8, { angle: 90 });
        return;
      }
      if (section !== 'body' || column.index !== COL_CLIENTE) return;
      // SIM [ ]  NÃO [ ] em todas as linhas, marcado conforme a resposta de "Cliente presente?".
      const valor = linhas[row.index]?.clientePresente;
      const box = 2.6;
      const y = cell.y + (cell.height - box) / 2;
      pen(doc, 5.5);
      doc.text('SIM', cell.x + 0.8, y + box - 0.4);
      checkbox(doc, cell.x + 5, y, box, valor === 'Sim');
      doc.text('NÃO', cell.x + 8.4, y + box - 0.4);
      checkbox(doc, cell.x + 13.4, y, box, valor === 'Não');
    },
  });
}

/** TEC.LIDER RESPONSAVEL PELA EQUIPE + PRODUÇÃO TOTAL e os técnicos cadastrados (3 por linha) com o quadradinho. */
function rodape(doc: jsPDF, h: ShiftHeader, total: number, tecnicos: readonly Tecnico[]): void {
  const POR_LINHA = 3;
  // Sem técnico cadastrado, a folha sai com os três quadradinhos em branco, como o modelo de papel.
  const linhas = Math.max(1, Math.ceil(tecnicos.length / POR_LINHA));
  const body: RowInput[] = [[{ content: 'TEC.LIDER RESPONSAVEL PELA EQUIPE', colSpan: 4, styles: { ...LABEL, fontSize: 7.5, halign: 'center', minCellHeight: 5 } }]];
  for (let i = 0; i < linhas; i++) {
    // Cada célula de técnico tem a própria altura (nome, telefone e quadradinho cabem em qualquer linha).
    const slots = Array.from({ length: POR_LINHA }, () => ({ content: '', styles: { minCellHeight: 16 } }));
    body.push(i === 0 ? [{ content: '', rowSpan: linhas }, ...slots] : slots);
  }
  block(doc, {
    // O rodapé fica sempre junto: se não couber, vai inteiro para a folha seguinte.
    pageBreak: 'avoid',
    columnStyles: { 0: { cellWidth: 53.7 }, 1: { cellWidth: 75.8 }, 2: { cellWidth: 75.8 }, 3: { cellWidth: 75.7 } },
    body,
    didDrawCell: ({ cell, column, row, section }: CellHookData) => {
      if (section !== 'body' || row.index === 0) return;
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
      const tecnico = tecnicos[(row.index - 1) * POR_LINHA + column.index - 1];
      if (tecnico) {
        const cx = cell.x + cell.width / 2;
        pen(doc, 7.5);
        // Nome longo quebra em mais linhas e empurra o telefone para baixo.
        const nome = doc.splitTextToSize(tecnico.nome, cell.width - 4) as string[];
        doc.text(nome, cx, cell.y + 5, { align: 'center' });
        pen(doc, 7);
        doc.text(tecnico.telefone, cx, cell.y + 5 + nome.length * 3.3 + 1.2, { align: 'center' });
      }
      checkbox(doc, cell.x + 4, cell.y + cell.height - 6, 3.6, !!tecnico && tecnico.id === h.lider);
    },
  });
}

/** Embaixo de toda folha: data e equipe à esquerda, "FOLHA n/N" à direita (folhas soltas continuam identificáveis). */
function rodapePaginas(doc: jsPDF, h: ShiftHeader): void {
  const total = doc.getNumberOfPages();
  const { width, height } = doc.internal.pageSize;
  const y = height - MARGIN.bottom / 2;
  const turno = [`DATA: ${formatDateBR(h.data)}`, h.equipe ? `EQUIPE: ${h.equipe}` : ''].filter(Boolean).join('   |   ');
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    pen(doc, 7);
    doc.text(turno, MARGIN.left, y);
    doc.text(`FOLHA ${p}/${total}`, width - MARGIN.right, y, { align: 'right' });
  }
}

/**
 * PDF do Espelho de Campo (A4 paisagem), idêntico ao modelo de papel. Até 15 OSs, uma folha; acima disso, mais
 * uma folha a cada 15, só com a tabela (títulos das colunas repetidos, ITEM continuando). Logo e identificação
 * ficam na primeira folha; a produção total e os técnicos, na última.
 */
export function buildSheetPdf(header: ShiftHeader, ordens: readonly OrdemServico[], tecnicos: readonly Tecnico[]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const linhas = espelhoRows(ordens);
  const folhas = Math.max(1, Math.ceil(linhas.length / LINHAS_FOLHA));
  for (let f = 0; f < folhas; f++) {
    const pagina = linhas.slice(f * LINHAS_FOLHA, (f + 1) * LINHAS_FOLHA);
    if (f === 0) {
      titulo(doc);
      identificacao(doc, header);
      tabelaServicos(doc, pagina, 1);
    } else {
      doc.addPage();
      tabelaServicos(doc, pagina, f * LINHAS_FOLHA + 1, MARGIN.top);
    }
  }
  rodape(doc, header, ordens.length, tecnicos);
  rodapePaginas(doc, header);
  return doc;
}
