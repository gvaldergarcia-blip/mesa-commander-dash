# Architecture rules

- Keep receipt mobile selection as presentation-only state in ReceiptEntryTab; all rows remain in the existing draft and submission logic so compact editing does not change inventory or printing.
- Share original-expiry cycle resolution between Renewal and Dashboard through originalExpiry, with rule tests, so cached labels cannot disagree about manufacturer expiry.
- Render the pre-print preview from LabelPrintSheet's existing HTML and styles at a uniformly scaled physical size, omitting QR data, so the final print design stays unchanged.
- Share receipt print-field validation and stock movement construction through receiptRules, with rule tests; receipt success refreshes stock balances and movement history directly instead of relying on realtime delivery.