const DEFAULT_COUNTRY_CODE = '+880';
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export function normalizeNumber(raw: string): string | null {
  if (!raw) return null;

  let cleaned = raw.replace(/[^\d+]/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('+')) {
    if (!E164_REGEX.test(cleaned)) return null;
    return cleaned;
  }

  if (cleaned.startsWith('880')) {
    const withPrefix = `+${cleaned}`;
    if (!E164_REGEX.test(withPrefix)) return null;
    return withPrefix;
  }

  if (cleaned.startsWith('0')) {
    const rest = cleaned.slice(1);
    if (!/^\d{1,14}$/.test(rest)) return null;
    return `${DEFAULT_COUNTRY_CODE}${rest}`;
  }

  if (cleaned.length >= 7) {
    return `${DEFAULT_COUNTRY_CODE}${cleaned}`;
  }

  return null;
}