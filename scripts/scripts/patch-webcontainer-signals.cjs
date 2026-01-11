// scripts/patch-webcontainer-signals.cjs
// WebContainer can pass a signal string into process.exit(), which crashes Next:
// TypeError: The "code" argument must be of type number. Received type string ('SIGINT')

const IGNORE = new Set(["SIGINT", "SIGTERM", "SIGHUP"]);

const origExit = process.exit.bind(process);
process.exit = (code) => {
  if (typeof code === "string" && IGNORE.has(code)) return origExit(0);
  if (code == null) return origExit(0);
  return origExit(code);
};

const origOnce = process.once.bind(process);
process.once = (event, listener) => {
  if (IGNORE.has(event)) return process;
  return origOnce(event, listener);
};
