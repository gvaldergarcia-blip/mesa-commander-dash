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

interface Props {
  data: PrintLabelData | null;
}

/**
 * Print-only sheet. Hidden on screen; rendered only when window.print() is invoked.
 * Uses pure black/white styling for compatibility with any printer (thermal/laser).
 */
export function LabelPrintSheet({ data }: Props) {
  if (!data) return null;
  const labels = Array.from({ length: data.quantity });
  const fmtDateTime = (d: Date) => format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const fmtDate = (d: Date) => format(d, "dd/MM/yyyy", { locale: ptBR });

  return (
    <div className="print-area" aria-hidden="true">
      {labels.map((_, i) => (
        <div key={i} className="print-label">
          <div className="print-label-name">{data.productName}</div>
          <div className="print-label-row">
            <span className="print-label-key">Fabricação:</span>{" "}
            <span>{fmtDateTime(data.manufactureDate)}</span>
          </div>
          <div className="print-label-row">
            <span className="print-label-key">Validade:</span>{" "}
            <span>{fmtDate(data.expiryDate)}</span>
          </div>
          <div className="print-label-row">
            <span className="print-label-key">Responsável:</span>{" "}
            <span>{data.responsible}</span>
          </div>
          {data.notes && (
            <div className="print-label-notes">
              <span className="print-label-key">Obs:</span> {data.notes}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}