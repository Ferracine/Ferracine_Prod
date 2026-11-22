import { strToU8, zipSync } from 'fflate';
import { SERVICE_LABEL } from './domain/catalog';
import { espelhoRows } from './domain/espelho';
import { formatDateBR, formatHorario } from './domain/format';
import type { OrdemServico, ShiftHeader, Tecnico } from './domain/types';

/**
 * Planilha do Espelho de Campo (.xlsx, abre no Excel, Google Planilhas e LibreOffice), com o mesmo conteúdo do PDF:
 * identificação da equipe no topo e uma linha por OS. Montada à mão (Office Open XML mínimo + zip do fflate),
 * sem biblioteca de planilha: funciona offline e pesa pouco. Números de OS, medidores e leituras vão como texto
 * para não perder zeros à esquerda nem virar notação científica.
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const COLUNAS = [
  'ITEM', 'OS/OCORRÊNCIA', 'TIPO', 'CÓDIGO', 'KM INICIAL', 'HORÁRIO INICIAL', 'HORÁRIO FINAL', 'KM FINAL',
  'MEDIDOR INSTALADO', 'LEITURA INSTALADO', 'MEDIDOR RETIRADO', 'LEITURA RETIRADO', 'CLIENTE PRESENTE', 'INFO ADICIONAL',
] as const;
/** Larguras (em caracteres) de cada coluna da tabela. */
const LARGURAS = [6, 16, 13, 9, 11, 10, 10, 11, 18, 12, 18, 12, 10, 70];

/** Estilos (xl/styles.xml): 0 normal, 1 negrito, 2 texto longo quebrando linha. */
const S = { normal: 0, negrito: 1, quebra: 2 } as const;

type Celula = string | number | { v: string | number; s: number };

function esc(texto: string): string {
  // Também tira caracteres de controle, que deixam o XML inválido (o Excel recusa o arquivo).
  return texto
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 0 → A, 25 → Z, 26 → AA... */
function coluna(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function celula(c: Celula, ref: string): string {
  const { v, s } = typeof c === 'object' ? c : { v: c, s: S.normal };
  const estilo = s ? ` s="${s}"` : '';
  if (typeof v === 'number') return `<c r="${ref}"${estilo}><v>${v}</v></c>`;
  if (v === '') return '';
  return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function planilhaXml(linhas: Celula[][]): string {
  const cols = LARGURAS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const rows = linhas
    .map((l, r) => `<row r="${r + 1}">${l.map((c, i) => celula(c, `${coluna(i)}${r + 1}`)).join('')}</row>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`
  );
}

const ARQUIVOS_FIXOS: Record<string, string> = {
  '[Content_Types].xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>',
  '_rels/.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>',
  'xl/workbook.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Espelho de Campo" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>',
  'xl/styles.xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
};

/** Linhas da planilha: identificação (rótulo em negrito + valor) e a tabela das OSs. */
export function planilhaLinhas(h: ShiftHeader, ordens: readonly OrdemServico[], tecnicos: readonly Tecnico[]): Celula[][] {
  const rotulo = (t: string) => ({ v: t, s: S.negrito });
  const lider = tecnicos.find((t) => t.id === h.lider);
  const ident: Celula[][] = [
    [rotulo('ESPELHO DE CAMPO - FOLHA DE PRODUÇÃO DIÁRIA')],
    [],
    [rotulo('Eletricista 1'), h.nome1, rotulo('Matrícula'), h.mat1],
    ...(h.nome2.trim() ? [[rotulo('Eletricista 2'), h.nome2, rotulo('Matrícula'), h.mat2]] : []),
    [rotulo('Equipe'), h.equipe, rotulo('Viatura'), h.viatura],
    [rotulo('Data'), formatDateBR(h.data), rotulo('Horário'), formatHorario(h)],
    [rotulo('Bodycam'), h.bodycam1, rotulo('Bodycam 2'), h.bodycam2],
    [rotulo('Técnico líder'), lider ? (lider.telefone ? `${lider.nome} - ${lider.telefone}` : lider.nome) : ''],
    [rotulo('Produção total'), ordens.length],
    [],
    COLUNAS.map(rotulo),
  ];
  // KM só com dígitos (sem zero à esquerda) vai como número, para o Excel somar; OS, medidor e leitura ficam texto.
  const km = (v: string): Celula => (/^[1-9]\d{0,8}$/.test(v) ? Number(v) : v);
  const tabela = espelhoRows(ordens).map((r, i): Celula[] => [
    r.item, r.os, SERVICE_LABEL[ordens[i]!.serviceType], r.codigo, km(r.kmIni), r.horaIni, r.horaFin, km(r.kmFin),
    r.medidorInstalado, r.leituraInstalado, r.medidorRetirado, r.leituraRetirado, r.clientePresente,
    { v: r.info, s: S.quebra },
  ]);
  return [...ident, ...tabela];
}

/** Arquivo .xlsx (bytes) do turno. */
export function buildSheetXlsx(h: ShiftHeader, ordens: readonly OrdemServico[], tecnicos: readonly Tecnico[]): Uint8Array<ArrayBuffer> {
  const arquivos = Object.fromEntries(Object.entries(ARQUIVOS_FIXOS).map(([k, v]) => [k, strToU8(v)]));
  arquivos['xl/worksheets/sheet1.xml'] = strToU8(planilhaXml(planilhaLinhas(h, ordens, tecnicos)));
  return zipSync(arquivos, { level: 6 });
}

