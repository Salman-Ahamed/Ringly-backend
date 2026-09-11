import { normalizeNumber } from '../src/utils/numberNormalizer';

describe('normalizeNumber', () => {
  it('adds default country code to local numbers with leading 0', () => {
    expect(normalizeNumber('01712345678')).toBe('+8801712345678');
  });

  it('adds default country code to local numbers without leading 0', () => {
    expect(normalizeNumber('1712345678')).toBe('+8801712345678');
  });

  it('keeps valid E.164 numbers unchanged', () => {
    expect(normalizeNumber('+8801712345678')).toBe('+8801712345678');
  });

  it('adds + prefix to numbers starting with country code', () => {
    expect(normalizeNumber('8801712345678')).toBe('+8801712345678');
  });

  it('strips spaces, dashes, and parentheses', () => {
    expect(normalizeNumber('+880 (1712) 345-678')).toBe('+8801712345678');
  });

  it('returns null for empty input', () => {
    expect(normalizeNumber('')).toBeNull();
    expect(normalizeNumber('   ')).toBeNull();
  });

  it('returns null for non-numeric garbage', () => {
    expect(normalizeNumber('abc')).toBeNull();
    expect(normalizeNumber('!!')).toBeNull();
  });

  it('returns null for invalid E.164 with bad prefix', () => {
    expect(normalizeNumber('++880123')).toBeNull();
  });

  it('returns null for overly short numbers', () => {
    expect(normalizeNumber('12')).toBeNull();
  });

  it('returns null for numbers longer than E.164 max (15 digits)', () => {
    const tooLong = '+1' + '2'.repeat(15);
    expect(normalizeNumber(tooLong)).toBeNull();
  });
});