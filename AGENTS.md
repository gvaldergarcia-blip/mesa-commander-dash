# Architecture rules

- Enforce original-expiry renewal guards and lot-wide expiry discharge in PostgreSQL; quantitative usage and expiry waste share the stock-movement ledger and a per-product transaction lock to avoid competing debits.
- Keep the QR scan page usage-only and constrain quantity inputs with min-width zero so unit selectors cannot expand the mobile viewport.

- Keep receipt mobile selection as presentation-only state in ReceiptEntryTab; all rows remain in the existing draft and submission logic so compact editing does not change inventory or printing.
- Share original-expiry cycle resolution between Renewal and Dashboard through originalExpiry, with rule tests, so cached labels cannot disagree about manufacturer expiry.
- Render the pre-print preview from LabelPrintSheet's existing HTML and styles at a uniformly scaled physical size, omitting QR data, so the final print design stays unchanged.
- Keep a noninteractive gesture surface above the print-preview iframe so mobile swipes stay in the page's scroll context rather than entering an embedded document.
- Share receipt print-field validation and stock movement construction through receiptRules, with rule tests; receipt success refreshes stock balances and movement history directly instead of relying on realtime delivery.