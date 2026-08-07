/** Formatting helpers shared by the bounty pages. */

export function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Wei (as decimal string) → FLR with up to 4 decimals. */
export function formatFlr(wei: string): string {
  const value = BigInt(wei);
  const whole = value / 10n ** 18n;
  const frac = (value % 10n ** 18n) / 10n ** 14n;
  if (frac === 0n) {
    return whole.toString();
  }
  return `${whole}.${frac.toString().padStart(4, "0").replace(/0+$/, "")}`;
}

export function formatUsdCents(cents: string): string {
  const value = Number(cents);
  return (value / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Seconds-precision unix timestamp → "in 6d" / "expired". */
export function timeLeft(expiresAt: string, nowMs = Date.now()): string {
  const diff = Number(expiresAt) * 1000 - nowMs;
  if (diff <= 0) {
    return "expired";
  }
  const days = Math.floor(diff / 86_400_000);
  if (days > 0) {
    return `in ${days}d`;
  }
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) {
    return `in ${hours}h`;
  }
  return `in ${Math.max(1, Math.floor(diff / 60_000))}m`;
}
