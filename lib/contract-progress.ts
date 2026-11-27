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
 * never for a contract asking nothing), and past its day while still open
 * (`today` is "YYYY-MM-DD" in Paris).
 */
export function contractStatus(
  contract: { lines: ContractLineStock[]; dueOn: string | null; deliveredAt: Date | null },
  today: string,
) {
  const { ready, total } = contractProgress(contract.lines);
  return {
    allReady: total > 0 && ready === total,
    late: !contract.deliveredAt && contract.dueOn !== null && contract.dueOn < today,
  };
}
