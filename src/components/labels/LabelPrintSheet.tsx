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
 * Imprime as etiquetas em uma janela limpa e isolada.
 *
 * Isso evita travar o dashboard e é mais compatível com drivers Epson/Chrome
 * do que imprimir a partir de um iframe oculto.
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
  @page { size: auto; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000;
    font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; }
  body { padding: 0; }
  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    padding: 12px;
    border-bottom: 1px solid #ddd;
    font-size: 14px;
  }
  .toolbar button {
    border: 1px solid #111;
    background: #111;
    color: #fff;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 700;
  }
  .sheet { padding: 8mm; }
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
  @media print {
    .toolbar { display: none !important; }
    .sheet { padding: 0; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span>Se a impressão não abrir automaticamente, clique:</span>
    <button type="button" onclick="window.print()">Imprimir agora</button>
  </div>
  <main class="sheet">${labelsHtml}</main>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    });
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=720,height=900,noreferrer");
  if (!printWindow) {
    window.alert("O navegador bloqueou a janela de impressão. Permita pop-ups para imprimir as etiquetas.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}