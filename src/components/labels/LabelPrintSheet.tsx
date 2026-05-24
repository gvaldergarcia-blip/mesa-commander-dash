import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PrintLabelData {
  productName: string;
  manufactureDate: Date;
  expiryDate: Date;
  responsible: string;
  notes?: string | null;
  cif?: string | null;
  quantity: number;
  batch?: string | null;
  quantityWeight?: string | null;
  restaurantName?: string | null;
  restaurantLogoUrl?: string | null;
  /** SVG markup pronto (ex: renderToStaticMarkup(<QRCodeSVG/>)) */
  checklistQrSvg?: string | null;
  /** Texto curto exibido abaixo do QR */
  checklistQrLabel?: string | null;
}

const fmtDateTime = (d: Date) => format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
const fmtDate = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR });

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Imprime as etiquetas na própria página, sem pop-up.
 *
 * O Chrome dentro do preview bloqueia janelas novas; por isso criamos uma área
 * temporária fora do app e, durante o @media print, mostramos só a etiqueta.
 */
export function printLabels(data: PrintLabelData) {
  const hasQr = !!data.checklistQrSvg;
  const hasLogo = !!data.restaurantLogoUrl;
  const headerRight = hasQr
    ? `<div class="qr-wrap">${data.checklistQrSvg}${
        data.checklistQrLabel ? `<div class="qr-label">${escapeHtml(data.checklistQrLabel)}</div>` : ""
      }</div>`
    : hasLogo
    ? `<img class="logo" src="${escapeHtml(data.restaurantLogoUrl!)}" alt="logo" />`
    : `<div class="rest-name-top">${escapeHtml(data.restaurantName || "")}</div>`;

  const bodyRows: string[] = [];
  bodyRows.push(`<div class="cell"><span class="k">Fab:</span> ${escapeHtml(fmtDateTime(data.manufactureDate))}</div>`);
  bodyRows.push(`<div class="cell"><span class="k">Val:</span> ${escapeHtml(fmtDate(data.expiryDate))}</div>`);
  bodyRows.push(`<div class="cell"><span class="k">Resp:</span> ${escapeHtml(data.responsible)}</div>`);
  if (data.batch) bodyRows.push(`<div class="cell"><span class="k">Lote:</span> ${escapeHtml(data.batch)}</div>`);
  if (data.quantityWeight) bodyRows.push(`<div class="cell"><span class="k">Qtd:</span> ${escapeHtml(data.quantityWeight)}</div>`);

  const labelsHtml = Array.from({ length: data.quantity })
    .map(
      () => `
        <div class="label">
          <div class="header">
            <div class="name">${escapeHtml(data.productName)}</div>
            <div class="header-right">${headerRight}</div>
          </div>
          <div class="body">${bodyRows.join("")}</div>
          ${
            data.notes
              ? `<div class="notes"><span class="k">Obs:</span> ${escapeHtml(data.notes)}</div>`
              : ""
          }
          ${
            data.cif
              ? `<div class="cif"><span class="k">CIF:</span> ${escapeHtml(data.cif)}</div>`
              : ""
          }
          ${
            data.restaurantName
              ? `<div class="footer">${escapeHtml(data.restaurantName)}</div>`
              : ""
          }
        </div>`
    )
    .join("");

  const html = `<main class="label-print-sheet">${labelsHtml}</main>`;
  const styleText = `
  @media screen {
    .label-print-runtime { display: none !important; }
  }
  @media print {
    @page { size: 80mm 40mm; margin: 0; }
    body > *:not(.label-print-runtime) { display: none !important; }
    .label-print-runtime, .label-print-runtime * { display: revert; visibility: visible; }
    .label-print-runtime {
      display: block !important;
      position: static !important;
      background: #fff !important;
      color: #000 !important;
      font-family: Arial, Helvetica, sans-serif !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-print-sheet { padding: 0; }
  .label {
    width: 80mm;
    height: 40mm;
    box-sizing: border-box;
    border: 1px solid #000;
    padding: 2mm 3mm;
    margin: 0;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: always;
    background: #fff !important;
    color: #000 !important;
    font-size: 8pt;
    line-height: 1.2;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .label:last-child { page-break-after: auto; }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2mm;
    border-bottom: 1px solid #000;
    padding-bottom: 1mm;
    margin-bottom: 1.5mm;
  }
  .name {
    font-size: 12pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  .header-right { flex-shrink: 0; display: flex; align-items: center; }
  .logo { width: 20px; height: 20px; object-fit: contain; }
  .rest-name-top { font-size: 8pt; font-weight: 700; text-transform: uppercase; }
  .qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.5mm; }
  .qr-wrap svg { width: 14mm; height: 14mm; display: block; }
  .qr-label { font-size: 5pt; text-align: center; line-height: 1; max-width: 16mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 3mm;
    row-gap: 0.5mm;
    flex: 1;
  }
  .cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 8pt; }
  .k { font-weight: 700; }
  .notes {
    margin-top: 1mm;
    padding-top: 1mm;
    border-top: 1px dashed #000;
    font-style: italic;
    font-size: 7pt;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cif {
    margin-top: 0.5mm;
    font-size: 7pt;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .footer {
    margin-top: 1mm;
    padding-top: 1mm;
    border-top: 1px solid #000;
    text-align: center;
    font-size: 7pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  }
  `;

  const existing = document.querySelectorAll(".label-print-runtime, style[data-label-print]");
  existing.forEach((node) => node.remove());

  const style = document.createElement("style");
  style.setAttribute("data-label-print", "true");
  style.textContent = styleText;

  const container = document.createElement("div");
  container.className = "label-print-runtime";
  container.innerHTML = html;

  const cleanup = () => {
    style.remove();
    container.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  document.head.appendChild(style);
  document.body.appendChild(container);
  window.addEventListener("afterprint", cleanup);

  requestAnimationFrame(() => {
    window.print();
    setTimeout(cleanup, 60000);
  });
}