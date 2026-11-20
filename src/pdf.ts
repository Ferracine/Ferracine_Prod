import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { SERVICE_LABEL } from './domain/catalog';
import { countByType, formatDateBR, formatHorario, orDash, plural } from './domain/format';
import type { OrdemServico, ShiftHeader } from './domain/types';
import { answerRows } from './domain/wizard';

type RGB = [number, number, number];

const NAVY: RGB = [15, 41, 74];
const BLUE: RGB = [0, 114, 206];
const GREEN: RGB = [16, 110, 75];
const GRAY_LABEL: RGB = [230, 234, 240];
const DITAIS_BG: RGB = [254, 242, 242];
const DITAIS_TEXT: RGB = [185, 28, 28];
const MUTED: RGB = [140, 140, 140];

const MARGIN = { top: 14, left: 10, right: 10, bottom: 16 };

function finalY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** Monta o PDF oficial da folha (A4 retrato), no layout da planilha de papel. */
export function buildSheetPdf(header: ShiftHeader, ordens: readonly OrdemServico[], emitidoEm: Date): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const data = formatDateBR(header.data);

  // Faixa institucional
  doc.setFillColor(...NAVY);
  doc.rect(10, 10, 190, 11, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ENERGISA', 14, 17);
  doc.setFontSize(9.5);
  doc.text('DEPARTAMENTO DE OPERAÇÃO — FOLHA DE PRODUÇÃO DIÁRIA', 196, 17, { align: 'right' });

  // Cabeçalho da equipe
  const label = { fontStyle: 'bold' as const, fillColor: GRAY_LABEL };
  autoTable(doc, {
    startY: 21,
    margin: MARGIN,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, lineColor: [140, 150, 165], lineWidth: 0.25, textColor: [20, 20, 20] },
    body: [
      [
        { content: 'NOME 1:', styles: { ...label, cellWidth: 20 } },
        { content: header.nome1, styles: { cellWidth: 55 } },
        { content: 'MAT. 1:', styles: { ...label, cellWidth: 16 } },
        { content: header.mat1, styles: { cellWidth: 22 } },
        { content: 'DATA:', styles: { ...label, cellWidth: 20 } },
        { content: data, styles: { cellWidth: 22 } },
        { content: `BODYCAM 1: ${orDash(header.bodycam1)}`, styles: { ...label, cellWidth: 35 } },
      ],
      [
        { content: 'NOME 2:', styles: label },
        { content: orDash(header.nome2) },
        { content: 'MAT. 2:', styles: label },
        { content: orDash(header.mat2) },
        { content: 'HORÁRIO:', styles: label },
        { content: formatHorario(header), colSpan: 2 },
      ],
    ],
  });

  // Resumo
  const { comercial, ocorrencia } = countByType(ordens);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(
    `TOTAL: ${plural(ordens.length, 'OS', 'OSs')}  •  COMERCIAL: ${comercial}  •  OCORRÊNCIA: ${ocorrencia}`,
    10,
    finalY(doc) + 5,
  );
  let y = finalY(doc) + 8;

  if (ordens.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Nenhuma Ordem de Serviço registrada neste turno.', 14, y + 6);
  }

  ordens.forEach((os, idx) => {
    autoTable(doc, {
      startY: y,
      margin: MARGIN,
      theme: 'grid',
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      head: [[{
        content: `ATENDIMENTO #${idx + 1}  |  OS: ${os.osNumber}  |  TIPO: ${SERVICE_LABEL[os.serviceType]} (CÓDIGO ${os.serviceCode})`,
        colSpan: 2,
        styles: {
          fillColor: os.serviceType === 'COMERCIAL' ? GREEN : BLUE,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: 2.5,
        },
      }]],
      body: answerRows(os).map((row, qIdx) => [
        {
          content: `${qIdx + 1}. ${row.question}`,
          styles: {
            cellWidth: 95,
            fontStyle: row.isDitais ? 'bold' : 'normal',
            fillColor: row.isDitais ? DITAIS_BG : [250, 251, 252],
          },
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
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, lineColor: [200, 208, 218], lineWidth: 0.2 },
    });
    y = finalY(doc) + 5;
  });

  // Rodapé em todas as páginas
  const emitido = emitidoEm.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Energisa - Folha de Produção Diária | Equipe: ${header.nome1} | Data: ${data} | Emitido em ${emitido} | Página ${i} de ${totalPages}`,
      105,
      290,
      { align: 'center' },
    );
  }

  return doc;
}
