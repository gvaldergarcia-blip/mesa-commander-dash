import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PrintLabelData {
  productName: string;
  manufactureDate: Date;
  expiryDate: Date;
  responsible: string;
  notes?: string | null;
  /** Faixa de destaque no topo (ex.: "MANIPULADO", "PRODUÇÃO INTERNA") */
  banner?: string | null;
  /** Tipo de etiqueta — controla o layout de datas.
   *  - "received"     : RECEBIDO EM + VAL. ORIGINAL (padrão para recebimentos)
   *  - "manipulation" : VAL. ORIGINAL + MANIPULAÇÃO + VALIDADE (produto manipulado)
   *  - "production"   : PRODUZIDO EM + VALIDADE (produção interna) */
  template?: "received" | "manipulation" | "production";
  cif?: string | null;
  sif?: string | null;
  /** Tipo de registro de inspeção: SIF, SISP ou IMPORTADO. Define o rótulo impresso. */
  inspectionType?: "SIF" | "SISP" | "IMPORTADO" | null;
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
  restaurantAddress?: string | null;
  /** Marca do fabricante e/ou fornecedor (ex: "SWIFT"). Impresso como MARCA/FORN. */
  brand?: string | null;
  /** Validade original do fabricante (usado quando o produto foi manipulado/aberto). */
  originalExpiryDate?: Date | null;
  /** SVG markup pronto (ex: renderToStaticMarkup(<QRCodeSVG/>)) */
  checklistQrSvg?: string | null;
  /** Texto curto exibido abaixo do QR */
  checklistQrLabel?: string | null;
}

const fmtDateTime = (value: Date | string | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Regras visuais da etiqueta 80×40mm — compartilhadas entre a impressão inline
 *  (desktop) e o documento independente usado no celular. */
const LABEL_RULES = `
    .label-print-sheet { padding: 0; }
    .label {
      width: 80mm; height: 40mm; box-sizing: border-box;
      padding: 1.6mm 2mm 1.3mm; margin: 0;
      page-break-inside: avoid; break-inside: avoid; page-break-after: always;
      background: #fff !important; color: #000 !important;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 6.4pt; line-height: 1.08;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .label:last-child { page-break-after: auto; }
    .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.4mm; }
    .top-left { flex: 1; min-width: 0; }
    .name { font-size: 9.5pt; font-weight: 800; letter-spacing: 0; line-height: 1; white-space: normal; overflow-wrap: anywhere; }
    .name.medium { font-size: 8pt; }
    .name.long { font-size: 6.5pt; line-height: 1.05; }
    .cons { font-size: 6pt; font-weight: 700; color: #000; margin-top: 0.2mm; letter-spacing: 0; }
    .weight { font-size: 9.5pt; font-weight: 800; white-space: nowrap; }
    .dates { margin-top: 0.8mm; border-top: 0.3mm solid #000; border-bottom: 0.3mm solid #000; padding: 0.7mm 0; }
    .d-row { display: flex; gap: 1.6mm; font-size: 6.2pt; line-height: 1.12; }
    .d-row .k { font-weight: 700; min-width: 15mm; }
    .d-row .v { font-weight: 600; }
    .local-row { margin-top: 0.7mm; font-size: 6.2pt; }
    .local-row .k { font-weight: 800; }
    .local-row .v { font-weight: 700; }
    .identity { margin-top: 0.5mm; display: flex; flex-wrap: wrap; gap: 0 2.5mm; }
    .id-row { font-size: 6.2pt; line-height: 1.15; white-space: nowrap; }
    .id-row .k { font-weight: 800; }
    .id-row .v { font-weight: 700; }
    .bottom { display: flex; justify-content: space-between; align-items: flex-end; gap: 1.2mm; margin-top: 0.7mm; flex: 1; min-height: 0; }
    .footer-info { flex: 1; min-width: 0; }
    .f-line { font-size: 5.7pt; line-height: 1.08; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .f-line .k { font-weight: 700; }
    .f-line.est { font-weight: 700; font-size: 6pt; }
    .f-line.addr { font-weight: 500; font-size: 5.6pt; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 0.25mm; flex: 0 0 13mm; }
    .qr-wrap svg { width: 13mm; height: 13mm; display: block; }
    .qr-label { font-size: 5pt; font-weight: 800; line-height: 1; letter-spacing: 0; }
    .allergens { margin-top: 0.35mm; font-size: 5.6pt; font-weight: 800; letter-spacing: 0; border: 0.3mm solid #000; padding: 0.35mm 0.6mm; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ingredients { margin-top: 0.35mm; font-size: 5.4pt; line-height: 1.02; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
    .ingredients .k { font-weight: 700; }
    .notes { margin-top: 0.35mm; font-size: 5.4pt; font-style: italic; line-height: 1.02; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .notes .k { font-weight: 700; font-style: normal; }
    .banner { background: #000 !important; color: #fff !important; font-size: 6.6pt; font-weight: 900; letter-spacing: 0.4mm; text-align: center; padding: 0.5mm 0; margin: -0.6mm -0.6mm 0.7mm; }
`;

/**
 * Imprime as etiquetas no padrão ANVISA (estilo YesChef), 80×40mm.
 */
export function printLabels(data: PrintLabelData) {
  return printLabelsMany([data]);
}

function buildLabelHtml(data: PrintLabelData): string {
  const nameClass = data.productName.length > 54
    ? "name long"
    : data.productName.length > 32
      ? "name medium"
      : "name";
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
  if (data.restaurantCep)
    footerLines.push(`<div class="f-line"><span class="k">CEP:</span> ${escapeHtml(data.restaurantCep)}</div>`);
  if (data.restaurantAddress)
    footerLines.push(`<div class="f-line addr">${escapeHtml(data.restaurantAddress)}</div>`);

  const allergensBlock = data.allergens
    ? `<div class="allergens">⚠ CONTÉM: ${escapeHtml(data.allergens.toUpperCase())}</div>`
    : "";

  const ingredientsBlock = data.ingredients
    ? `<div class="ingredients"><span class="k">Ingr:</span> ${escapeHtml(data.ingredients)}</div>`
    : "";

  const notesBlock = data.notes
    ? `<div class="notes"><span class="k">Obs:</span> ${escapeHtml(data.notes)}</div>`
    : "";

  // Modo do bloco de datas.
  const template = data.template
    || (data.originalExpiryDate ? "manipulation" : "received");
  const datesBlock = template === "production"
    ? `
        <div class="d-row"><span class="k">PRODUZIDO EM:</span><span class="v">${escapeHtml(fmtDateTime(data.manufactureDate))}</span></div>
        <div class="d-row"><span class="k">VALIDADE:</span><span class="v">${escapeHtml(fmtDateTime(data.expiryDate))}</span></div>
        ${data.batch ? `<div class="d-row"><span class="k">LOTE:</span><span class="v">${escapeHtml(data.batch)}</span></div>` : ""}`
    : template === "manipulation"
    ? `
        <div class="d-row"><span class="k">VAL. ORIGINAL:</span><span class="v">${escapeHtml(fmtDateTime(data.originalExpiryDate))}</span></div>
        <div class="d-row"><span class="k">MANIPULAÇÃO:</span><span class="v">${escapeHtml(fmtDateTime(data.manufactureDate))}</span></div>
        <div class="d-row"><span class="k">VALIDADE:</span><span class="v">${escapeHtml(fmtDateTime(data.expiryDate))}</span></div>
        ${data.batch ? `<div class="d-row"><span class="k">LOTE:</span><span class="v">${escapeHtml(data.batch)}</span></div>` : ""}`
    : `
        <div class="d-row"><span class="k">RECEBIDO EM:</span><span class="v">${escapeHtml(fmtDateTime(data.manufactureDate))}</span></div>
        <div class="d-row"><span class="k">VAL. ORIGINAL:</span><span class="v">${escapeHtml(fmtDateTime(data.expiryDate))}</span></div>
        ${data.batch ? `<div class="d-row"><span class="k">LOTE:</span><span class="v">${escapeHtml(data.batch)}</span></div>` : ""}`;

  const identityLines: string[] = [];
  // Produção Interna nunca deve exibir marca/fornecedor — é um alimento produzido internamente.
  if (data.brand && template !== "production")
    identityLines.push(`<div class="id-row"><span class="k">MARCA/FORN:</span> <span class="v">${escapeHtml(data.brand.toUpperCase())}</span></div>`);
  if (data.inspectionType === "IMPORTADO")
    identityLines.push(`<div class="id-row"><span class="k">PRODUTO IMPORTADO</span></div>`);
  if (data.sif) {
    const insLabel = data.inspectionType === "SISP" ? "SISP" : data.inspectionType === "IMPORTADO" ? "REG." : "SIF";
    identityLines.push(`<div class="id-row"><span class="k">${insLabel}:</span> <span class="v">${escapeHtml(data.sif)}</span></div>`);
  }
  if (data.cif)
    identityLines.push(`<div class="id-row"><span class="k">CIF:</span> <span class="v">${escapeHtml(data.cif)}</span></div>`);
  const identityBlock = identityLines.length ? `<div class="identity">${identityLines.join("")}</div>` : "";

  return `
        <div class="label">
          ${data.banner ? `<div class="banner">${escapeHtml(data.banner.toUpperCase())}</div>` : ""}
          <div class="top">
            <div class="top-left">
              <div class="${nameClass}">${escapeHtml(data.productName.toUpperCase())}</div>
              ${data.conservationLabel ? `<div class="cons">${escapeHtml(data.conservationLabel.toUpperCase())}</div>` : ""}
            </div>
            ${weight}
          </div>

          <div class="dates">${datesBlock}</div>

          ${data.storageLocation ? `<div class="local-row"><span class="k">LOCAL:</span> <span class="v">${escapeHtml(data.storageLocation.toUpperCase())}</span></div>` : ""}
          ${identityBlock}

          <div class="bottom">
            <div class="footer-info">${footerLines.join("")}</div>
            ${qrBlock}
          </div>

          ${allergensBlock}
          ${ingredientsBlock}
          ${notesBlock}
        </div>`;
}

/** Detecta ambiente onde a impressão inline (window.print da própria página) é instável:
 *  celulares (Chrome Android / iOS Safari) e execução dentro de iframe (preview/embed). */
function needsStandalonePrintWindow() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua);
  const isTouchSmall =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 900px)").matches &&
    navigator.maxTouchPoints > 0;
  let inIframe = false;
  try { inIframe = window.self !== window.top; } catch { inIframe = true; }
  return isMobileUa || isTouchSmall || inIframe;
}

/**
 * Imprime várias etiquetas de produtos diferentes em UM único job de impressão.
 * Cada item respeita o próprio `quantity`.
 */
export function printLabelsMany(items: PrintLabelData[]) {
  if (!items.length) return;
  const labelsHtml = items
    .map((d) => {
      const one = buildLabelHtml(d);
      const qty = Math.max(1, d.quantity || 1);
      return Array.from({ length: qty }).map(() => one).join("");
    })
    .join("");
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
${LABEL_RULES}
  }
  `;

  // ===== Celular / iframe: abrir documento próprio (Chrome Android e iOS Safari
  // não imprimem de forma confiável a partir da própria SPA / dentro de iframe).
  if (needsStandalonePrintWindow()) {
    const ok = openStandalonePrintDocument(html);
    if (ok) return;
    // se o popup foi bloqueado, cai no fluxo inline abaixo
  }

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

/** Abre uma janela/aba independente com as etiquetas, pronta para imprimir
 *  (ou "Salvar como PDF" e compartilhar com o app da impressora Bluetooth).
 *  Retorna false se o popup foi bloqueado. */
function openStandalonePrintDocument(labelsHtml: string): boolean {
  let win: Window | null = null;
  try {
    win = window.open("", "_blank");
  } catch {
    win = null;
  }
  if (!win) return false;

  const doc = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<title>Etiquetas · MesaClik</title>
<style>
  * { -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; background: #f4f4f5; color: #111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif; }
  .bar { position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; align-items: center;
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));
    background: #111; color: #fff; }
  .bar h1 { font-size: 15px; font-weight: 700; margin: 0; flex: 1; }
  .bar button { appearance: none; border: 0; border-radius: 10px; padding: 12px 16px;
    font-size: 15px; font-weight: 700; cursor: pointer; }
  .bar .go { background: #fff; color: #111; }
  .bar .close { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.35); }
  .hint { font-size: 12px; line-height: 1.4; color: #52525b; padding: 10px 14px 0; }
  .label-print-sheet { padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .label { background: #fff; color: #000; box-shadow: 0 1px 4px rgba(0,0,0,.18); }
${LABEL_RULES}
  @media screen { .label { height: 40mm; page-break-after: auto; } }
  @media print {
    @page { size: 80mm 40mm; margin: 0; }
    html, body { background: #fff; }
    .bar, .hint { display: none !important; }
    .label-print-sheet { padding: 0; display: block; }
    .label { box-shadow: none; page-break-after: always; }
    .label:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>
  <div class="bar">
    <h1>Etiquetas prontas</h1>
    <button class="close" onclick="window.close()">Fechar</button>
    <button class="go" onclick="window.print()">Imprimir</button>
  </div>
  <div class="hint">Se a impressora Bluetooth não aparecer na lista, escolha <b>Salvar como PDF</b> e compartilhe o arquivo com o aplicativo da impressora. Formato: 80×40&nbsp;mm.</div>
  ${labelsHtml}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { try { window.print(); } catch (e) {} }, 250);
    });
  <\/script>
</body>
</html>`;

  win.document.open();
  win.document.write(doc);
  win.document.close();
  try { win.focus(); } catch {}
  return true;
}
