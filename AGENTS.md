# Architecture rules

- Keep receipt mobile selection as presentation-only state in ReceiptEntryTab; all rows remain in the existing draft and submission logic so compact editing does not change inventory or printing.
- Share receipt print-field validation and stock movement construction through receiptRules, with rule tests; receipt success refreshes stock balances and movement history directly instead of relying on realtime delivery.