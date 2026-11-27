/**
 * How far the stock is from what a contract asks for. Pure: the Contrats page
 * and its tests read the same numbers.
 */

export type ContractLineStock = { quantity: number; stock: number };

/** One line: how much of it the stock already holds (`ready`), what is missing, and its share from 0 to 1. */
export function lineProgress({ quantity, stock }: ContractLineStock) {
  const ready = Math.min(Math.max(stock, 0), quantity);
  const ratio = quantity > 0 ? ready / quantity : 1;
  return { ready, missing: quantity - ready, percent: Math.floor(ratio * 100), ratio, done: ready >= quantity };
}

/**
 * The whole contract: each line counts the same, whatever its quantity (12 000
 * cuirs weigh no more than 60 peaux de loup), so `percent` is the mean of the
 * lines' shares, rounded down so 100 % means every line is ready.
 */
export function contractProgress(lines: ContractLineStock[]) {
  const progress = lines.map(lineProgress);
  const ready = progress.filter((p) => p.done).length;
  const mean = progress.length === 0 ? 0 : progress.reduce((sum, p) => sum + p.ratio, 0) / progress.length;
  return { percent: Math.floor(mean * 100), ready, total: lines.length };
}

/**
 * What a contract's card says of it: every line in stock (« Prêt à livrer »,
 * never for a contract asking nothing), and past its day while not delivered
 * (`today` is "YYYY-MM-DD" in Paris).
 */
export function contractStatus(
  contract: { lines: ContractLineStock[]; dueOn: string | null; delivered: boolean },
  today: string,
) {
  const { ready, total } = contractProgress(contract.lines);
  return {
    allReady: total > 0 && ready === total,
    late: !contract.delivered && contract.dueOn !== null && contract.dueOn < today,
  };
}

/**
 * A contract's price shared among the lines of the sale that delivers it, in
 * whole septims adding up to `price`: by what each line would sell for at the
 * shop's prices (`value`), or by quantity when a line has no sell price.
 * The rounding leftovers go to the largest remainders.
 */
export function splitPrice(price: number, lines: { quantity: number; value: number | null }[]) {
  if (lines.length === 0) return [];
  const byValue = lines.every((l) => l.value != null && l.value > 0);
  const weights = lines.map((l) => (byValue ? l.value! : l.quantity));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const exact = weights.map((w) => (price * w) / total);
  const amounts = exact.map(Math.floor);
  let left = price - amounts.reduce((sum, a) => sum + a, 0);
  const order = exact.map((e, i) => ({ i, rest: e - Math.floor(e) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    amounts[i] += 1;
    left -= 1;
  }
  return amounts;
}
