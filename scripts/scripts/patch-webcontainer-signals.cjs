// WebContainer patch: prevent SIGINT/SIGTERM cleanup from crashing Next inside StackBlitz
const IGNORE = new Set(["SIGINT", "SIGTERM"]);

const origOn = process.on.bind(process);
process.on = (event, listener) => {
  if (IGNORE.has(event)) return process;
  return origOn(event, listener);
};

const origOnce = process.once.bind(process);
process.once = (event, listener) => {
  if (IGNORE.has(event)) return process;
  return origOnce(event, listener);
};

const origExit = process.exit.bind(process);
process.exit = (code) => {
  if (typeof code === "string") return origExit(0);
  return origExit(code);
};
