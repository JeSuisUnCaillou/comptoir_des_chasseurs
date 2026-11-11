/**
 * A refusal a service gives the member as is ("Stock insuffisant…"). Thrown
 * inside a database transaction, it also rolls back everything written so far.
 */
export class UserError extends Error {}

/**
 * Runs a service for a Server Action: its result, or the message of the
 * UserError it threw. Any other error goes on.
 */
export async function attempt<T>(run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof UserError) return { ok: false, message: error.message };
    throw error;
  }
}
