// Interactive questions on the terminal. Secrets are typed at run time, never
// read from the environment or the command line, and never echoed.
import readline from "node:readline";

export function createPrompter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY),
  });
  // Lines typed (or piped) before a question is asked are kept for it.
  const lines = [];
  const waiting = [];
  let closed = false;
  let muted = false;
  rl._writeToOutput = (text) => {
    if (!muted) rl.output.write(text);
  };
  rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
  rl.on("close", () => {
    closed = true;
    while (waiting.length) waiting.shift()(null);
  });

  async function ask(question, { hidden = false } = {}) {
    process.stdout.write(question);
    muted = hidden;
    const line = lines.length
      ? lines.shift()
      : closed
        ? null
        : await new Promise((resolve) => waiting.push(resolve));
    muted = false;
    if (hidden) process.stdout.write("\n");
    if (line === null) throw new Error("Saisie interrompue.");
    return hidden ? line.replace(/\r$/, "") : line.trim();
  }

  return { ask, close: () => rl.close() };
}
