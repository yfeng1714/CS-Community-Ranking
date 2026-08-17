const iso2Pattern = /^[A-Z]{2}$/;

export function countryFlagEmoji(countryCode: string): string | null {
  const code = countryCode.trim().toUpperCase();
  if (!iso2Pattern.test(code)) return null;
  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}
