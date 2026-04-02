const INVALID_EMAIL_PLACEHOLDERS = new Set([
  '',
  '—',
  '-',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
  'sem email',
  'sem e-mail',
]);

export const normalizePhone = (phone?: string | null) => (phone || '').replace(/\D/g, '');

export const sanitizeOptionalEmail = (email?: string | null) => {
  if (typeof email !== 'string') return null;

  const normalizedEmail = email.trim().toLowerCase();
  if (INVALID_EMAIL_PLACEHOLDERS.has(normalizedEmail)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return null;

  return normalizedEmail;
};

export const resolveCustomerConsentEmail = (email?: string | null, phone?: string | null) => {
  const normalizedEmail = sanitizeOptionalEmail(email);
  if (normalizedEmail) return normalizedEmail;

  const phoneDigits = normalizePhone(phone);
  if (phoneDigits.length >= 10) return `${phoneDigits}@phone.local`;

  return null;
};