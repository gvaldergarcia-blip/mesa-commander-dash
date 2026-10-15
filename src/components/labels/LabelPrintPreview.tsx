import { useEffect, useMemo, useRef, useState } from "react";
import { buildLabelHtml, LABEL_RULES } from "./LabelPrintSheet";

interface LabelPrintPreviewProps {
  productName: string;
  conservationLabel?: string | null;
  quantityWeight?: string | null;
  originalExpiryDate?: Date | null;
  manipulationDate: Date;
  expiryDate: Date;
  batch?: string | null;
  storageLocation?: string | null;
  brand?: string | null;
  responsible: string;
  restaurantName?: string | null;
  restaurantCnpj?: string | null;
  restaurantCep?: string | null;
  allergens?: string | null;
  ingredients?: string | null;
  notes?: string | null;
  sif?: string | null;
  cif?: string | null;
  inspectionType?: "SIF" | "SISP" | "IMPORTADO" | null;
}

const LABEL_WIDTH_PX = 80 * 96 / 25.4;
const LABEL_HEIGHT_PX = 40 * 96 / 25.4;

export function LabelPrintPreview({
  productName,
  conservationLabel,
  quantityWeight,
  originalExpiryDate,
  manipulationDate,
  expiryDate,
  batch,
  storageLocation,
  brand,
  responsible,
  restaurantName,
  restaurantCnpj,
  restaurantCep,
  allergens,
  ingredients,
  notes,
  sif,
  cif,
  inspectionType,
}: LabelPrintPreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / LABEL_WIDTH_PX);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const document = useMemo(() => `<!doctype html><html><head><meta charset="utf-8" /><style>
    html, body { margin: 0; padding: 0; overflow: hidden; }
    ${LABEL_RULES}
  </style></head><body>${buildLabelHtml({
    productName, conservationLabel, quantityWeight, originalExpiryDate,
    manufactureDate: manipulationDate, expiryDate, batch, storageLocation,
    brand, responsible, restaurantName, restaurantCnpj, restaurantCep,
    allergens, ingredients, notes, sif, cif, inspectionType,
    template: "manipulation", quantity: 1,
  })}</body></html>`, [productName, conservationLabel, quantityWeight,
    originalExpiryDate, manipulationDate, expiryDate, batch, storageLocation,
    brand, responsible, restaurantName, restaurantCnpj, restaurantCep,
    allergens, ingredients, notes, sif, cif, inspectionType]);

  return (
    <section className="space-y-2" aria-label="Prévia da etiqueta">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Prévia da etiqueta</span>
        <span className="text-[11px] text-muted-foreground">80 × 40 mm</span>
      </div>

      <div className="overflow-hidden rounded-md border-2 border-label-ink/80 bg-label-paper shadow-sm">
        <div ref={frameRef} className="relative aspect-[2/1] w-full overflow-hidden">
          <iframe
            title="Modelo da etiqueta antes da impressão"
            sandbox=""
            tabIndex={-1}
            srcDoc={document}
            className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
            style={{ width: LABEL_WIDTH_PX, height: LABEL_HEIGHT_PX, transform: `scale(${scale})` }}
          />
        </div>
      </div>
    </section>
  );
}