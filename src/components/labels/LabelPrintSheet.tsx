import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PrintLabelData {
  productName: string;
  manufactureDate: Date;
  expiryDate: Date;
  responsible: string;
  notes?: string | null;
  quantity: number;
  batch?: string | null;
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
  const labelsHtml = Array.from({ length: data.quantity })
    .map(
      () => `
        <div class="label">
          <div class="name">${escapeHtml(data.productName)}</div>
          <div class="row"><span class="k">Fab:</span> ${escapeHtml(fmtDateTime(data.manufactureDate))}</div>
          <div class="row"><span class="k">Val:</span> ${escapeHtml(fmtDate(data.expiryDate))}</div>
          <div class="row"><span class="k">Resp:</span> ${escapeHtml(data.responsible)}</div>
          ${
            data.batch
              ? `<div class="row"><span class="k">Lote:</span> ${escapeHtml(data.batch)}</div>`
              : ""
          }
          ${
            data.notes
              ? `<div class="notes"><span class="k">Obs:</span> ${escapeHtml(data.notes)}</div>`
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
  }
  .label:last-child { page-break-after: auto; }
  .name {
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 1mm;
    margin-bottom: 1.5mm;
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row { margin: 0.5mm 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .k { font-weight: 700; }
  .notes {
    margin-top: 1mm;
    padding-top: 1mm;
    border-top: 1px dashed #000;
    font-style: italic;
    font-size: 7pt;
    line-height: 1.15;
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