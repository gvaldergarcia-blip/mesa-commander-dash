import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PrintLabelData {
  productName: string;
  manufactureDate: Date;
  expiryDate: Date;
  responsible: string;
  notes?: string | null;
  cif?: string | null;
  allergens?: string | null;
  ingredients?: string | null;
  conservationLabel?: string | null;
  storageLocation?: string | null;
  quantity: number;
  batch?: string | null;
  quantityWeight?: string | null;
  restaurantName?: string | null;
  restaurantLogoUrl?: string | null;
  restaurantCnpj?: string | null;
  restaurantCep?: string | null;
  /** SVG markup pronto (ex: renderToStaticMarkup(<QRCodeSVG/>)) */
  checklistQrSvg?: string | null;
  /** Texto curto exibido abaixo do QR */
  checklistQrLabel?: string | null;
}

const fmtDateTime = (d: Date) => format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Imprime as etiquetas no padrão ANVISA (estilo YesChef), 80×40mm.
 */
export function printLabels(data: PrintLabelData) {
  const qrBlock = data.checklistQrSvg
    ? `<div class="qr-wrap">${data.checklistQrSvg}${
        data.checklistQrLabel ? `<div class="qr-label">${escapeHtml(data.checklistQrLabel)}</div>` : ""
      }</div>`
    : "";

  const weight = data.quantityWeight ? `<div class="weight">${escapeHtml(data.quantityWeight)}</div>` : "";

  const footerLines: string[] = [];
  footerLines.push(
    `<div class="f-line"><span class="k">RESP:</span> ${escapeHtml(data.responsible)}</div>`
  );
  if (data.restaurantName)
    footerLines.push(`<div class="f-line est">${escapeHtml(data.restaurantName.toUpperCase())}</div>`);
  if (data.restaurantCnpj)
    footerLines.push(`<div class="f-line"><span class="k">CNPJ:</span> ${escapeHtml(data.restaurantCnpj)}</div>`);
  if (data.cif)
    footerLines.push(`<div class="f-line"><span class="k">CIF:</span> ${escapeHtml(data.cif)}</div>`);
  if (data.restaurantCep)
    footerLines.push(`<div class="f-line"><span class="k">CEP:</span> ${escapeHtml(data.restaurantCep)}</div>`);

  const allergensBlock = data.allergens
    ? `<div class="allergens">⚠ CONTÉM: ${escapeHtml(data.allergens.toUpperCase())}</div>`
    : "";

  const ingredientsBlock = data.ingredients
    ? `<div class="ingredients"><span class="k">Ingr:</span> ${escapeHtml(data.ingredients)}</div>`
    : "";

  const notesBlock = data.notes
    ? `<div class="notes"><span class="k">Obs:</span> ${escapeHtml(data.notes)}</div>`
    : "";

  const labelHtml = `
        <div class="label">
          <div class="top">
            <div class="top-left">
              <div class="name">${escapeHtml(data.productName.toUpperCase())}</div>
              ${data.conservationLabel ? `<div class="cons">${escapeHtml(data.conservationLabel.toUpperCase())}</div>` : ""}
            </div>
            ${weight}
          </div>

          <div class="dates">
            <div class="d-row"><span class="k">PREPARADO:</span><span class="v">${escapeHtml(fmtDateTime(data.manufactureDate))}</span></div>
            <div class="d-row"><span class="k">VALIDADE:</span><span class="v">${escapeHtml(fmtDateTime(data.expiryDate))}</span></div>
            ${data.batch ? `<div class="d-row"><span class="k">LOTE:</span><span class="v">${escapeHtml(data.batch)}</span></div>` : ""}
          </div>

          ${data.storageLocation ? `<div class="local-row"><span class="k">LOCAL:</span> <span class="v">${escapeHtml(data.storageLocation.toUpperCase())}</span></div>` : ""}

          <div class="bottom">
            <div class="footer-info">${footerLines.join("")}</div>
            ${qrBlock}
          </div>

          ${allergensBlock}
          ${ingredientsBlock}
          ${notesBlock}
        </div>`;

  const labelsHtml = Array.from({ length: data.quantity }).map(() => labelHtml).join("");
  const html = `<main class="label-print-sheet">${labelsHtml}</main>`;

  const styleText = `
  @media screen { .label-print-runtime { display: none !important; } }
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
      width: 80mm; height: 40mm; box-sizing: border-box;
      padding: 2mm 2.5mm; margin: 0;
      page-break-inside: avoid; break-inside: avoid; page-break-after: always;
      background: #fff !important; color: #000 !important;
      font-size: 7pt; line-height: 1.15;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .label:last-child { page-break-after: auto; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 2mm; }
    .top-left { flex: 1; min-width: 0; }
    .name { font-size: 11pt; font-weight: 800; letter-spacing: 0.2px; line-height: 1.05; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cons { font-size: 7pt; font-weight: 600; color: #000; margin-top: 0.3mm; letter-spacing: 0.3px; }
    .weight { font-size: 11pt; font-weight: 800; white-space: nowrap; }
    .dates { margin-top: 1.2mm; border-top: 0.3mm solid #000; border-bottom: 0.3mm solid #000; padding: 1mm 0; }
    .d-row { display: flex; gap: 2mm; font-size: 7pt; line-height: 1.25; }
    .d-row .k { font-weight: 700; min-width: 18mm; }
    .d-row .v { font-weight: 600; }
    .local-row { margin-top: 1mm; font-size: 7pt; }
    .local-row .k { font-weight: 800; }
    .local-row .v { font-weight: 700; }
    .bottom { display: flex; justify-content: space-between; align-items: flex-end; gap: 1.5mm; margin-top: 1mm; flex: 1; }
    .footer-info { flex: 1; min-width: 0; }
    .f-line { font-size: 6.5pt; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .f-line .k { font-weight: 700; }
    .f-line.est { font-weight: 700; font-size: 7pt; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 0.4mm; flex: 0 0 15mm; }
    .qr-wrap svg { width: 15mm; height: 15mm; display: block; }
    .qr-label { font-size: 6pt; font-weight: 800; line-height: 1; letter-spacing: 0; }
    .allergens { margin-top: 0.5mm; font-size: 6.5pt; font-weight: 800; letter-spacing: 0.2px; border: 0.3mm solid #000; padding: 0.5mm 1mm; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ingredients { margin-top: 0.5mm; font-size: 6pt; line-height: 1.1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .ingredients .k { font-weight: 700; }
    .notes { margin-top: 0.5mm; font-size: 6pt; font-style: italic; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .notes .k { font-weight: 700; font-style: normal; }
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