/**
 * The price of each stocked merchandise of a purchase or a sale, for a
 * contact's offers: its lines added together, then reduced ("6 septims for
 * 2" is "3 septims for 1"). Pure.
 */
export function offerPrices(lines: { productId: number | null; quantity: number; amount: number }[]) {
  const totals = new Map<number, { amount: number; quantity: number }>();
  for (const { productId, quantity, amount } of lines) {
    if (productId == null) continue;
    const total = totals.get(productId) ?? { amount: 0, quantity: 0 };
    totals.set(productId, { amount: total.amount + amount, quantity: total.quantity + quantity });
  }
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  return new Map(
    [...totals].map(([productId, { amount, quantity }]) => {
      const d = amount === 0 ? quantity : gcd(amount, quantity);
      return [productId, { price: amount / d, qty: quantity / d }];
    }),
  );
}
