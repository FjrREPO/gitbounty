/**
 * Encodes an FTSOv2 feed id: 1 category byte followed by the ASCII feed
 * name, right-padded with zeros to 21 bytes total.
 *
 * Category 0x01 is crypto; e.g. `encodeFeedId("FLR/USD")`.
 */
export function encodeFeedId(name: string, category = 0x01): `0x${string}` {
  const ascii = [...name].map((c) => c.charCodeAt(0));
  if (ascii.length > 20) {
    throw new Error(`feed name too long: ${name}`);
  }
  const bytes = [category, ...ascii, ...new Array<number>(20 - ascii.length).fill(0)];
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

/** Feed id for FLR/USD, used to convert USD rewards to FLR at payout time. */
export const FLR_USD = encodeFeedId("FLR/USD");
