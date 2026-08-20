export function isEmptyMode(): boolean {
  if (typeof process !== 'undefined' && process.env.EMPTY === '1') return true;
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('empty') === '1';
  }
  return false;
}

export function visitorTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}
