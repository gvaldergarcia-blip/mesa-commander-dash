/** Contexto de um recebimento que foi computado e seguiu para a impressão de etiquetas.
 *  Etiquetas geradas a partir daqui são de PRODUTO LACRADO:
 *  usam a VALIDADE ORIGINAL do fabricante — nunca manipulação/pós-abertura. */
export interface ReceiptPrintItem {
  key: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unit: string | null;
  /** Peso conferido no recebimento (vem da NF quando disponível, editável). */
  weight: number | null;
  weightUnit: string | null;
  batch: string | null;
  /** yyyy-MM-dd */
  originalExpiry: string | null;
}

export interface ReceiptPrintContext {
  receiptId: string;
  reference: string | null;
  supplierName: string | null;
  items: ReceiptPrintItem[];
}
