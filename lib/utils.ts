export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('uk-UA');
}

export function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((item) => String(item).padStart(2, '0'))
    .join(':');
}