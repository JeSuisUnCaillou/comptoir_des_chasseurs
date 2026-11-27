/**
 * How far the stock is from what a contract asks for. Pure: the Contrats page
 * and its tests read the same numbers.
 */

export type ContractLineStock = { quantity: number; stock: number };

/** One line: how much of it the stock already holds (`ready`), what is missing, and its share from 0 to 1. */
export function lineProgress({ quantity, stock }: ContractLineStock) {
  const ready = Math.min(Math.max(stock, 0), quantity);
  return { ready, missing: quantity - ready, ratio: quantity > 0 ? ready / quantity : 1, done: ready >= quantity };
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

/** The longest name and client a contract keeps, as in its form. */
export const CONTRACT_NAME_MAX = 100;
export const CONTRACT_CLIENT_MAX = 100;
