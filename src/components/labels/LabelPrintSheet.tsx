import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PrintLabelData {
  productName: string;
  manufactureDate: Date;
  expiryDate: Date;
  responsible: string;
  notes?: string | null;
  quantity: number;
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
 * Imprime as etiquetas em um IFRAME isolado.
 *
 * Por que iframe? `window.print()` na janela principal força o navegador a
 * percorrer toda a árvore de DOM do dashboard (gráficos, sidebar, realtime),
 * o que TRAVA a tela por vários segundos em listas grandes. Imprimindo em
 * um iframe oculto, o navegador só processa o conteúdo das etiquetas — a UI
 * principal permanece responsiva.
 */
export function printLabels(data: PrintLabelData) {
  const labelsHtml = Array.from({ length: data.quantity })
    .map(
      () => `
        <div class="label">
          <div class="name">${escapeHtml(data.productName)}</div>
          <div class="row"><span class="k">Fabricação:</span> ${escapeHtml(fmtDateTime(data.manufactureDate))}</div>
          <div class="row"><span class="k">Validade:</span> ${escapeHtml(fmtDate(data.expiryDate))}</div>
          <div class="row"><span class="k">Responsável:</span> ${escapeHtml(data.responsible)}</div>
          ${
            data.notes
              ? `<div class="notes"><span class="k">Obs:</span> ${escapeHtml(data.notes)}</div>`
              : ""
          }
        </div>`
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Etiquetas - ${escapeHtml(data.productName)}</title>
<style>
  @page { margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; }
  body { padding: 8mm; }
  .label {
    border: 1px solid #000;
    padding: 6mm;
    margin-bottom: 4mm;
    page-break-inside: avoid;
    break-inside: avoid;
    font-size: 11pt;
    line-height: 1.35;
  }
  .name {
    font-size: 16pt;
    font-weight: 700;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 2mm;
    margin-bottom: 3mm;
    letter-spacing: 0.5px;
  }
  .row { margin: 1mm 0; }
  .k { font-weight: 700; }
  .notes {
    margin-top: 2mm;
    padding-top: 2mm;
    border-top: 1px dashed #000;
    font-style: italic;
  }
</style>
</head>
<body>${labelsHtml}</body>
</html>`;

  // Cria iframe oculto e imprime apenas seu conteúdo (não trava o dashboard).
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const cleanup = () => {
    // Pequeno atraso para evitar abortar o diálogo de impressão.
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  iframe.onload = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      win.focus();
      win.print();
      // Após fechar o diálogo de impressão, remove o iframe.
      win.onafterprint = cleanup;
      // Fallback: garante remoção mesmo se onafterprint não disparar.
      setTimeout(cleanup, 60000);
    } catch {
      cleanup();
    }
  };

  const doc = iframe.contentDocument;
  if (!doc) {
    cleanup();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
}