/* WebContainer patch:
   - Next registers SIGINT/SIGTERM cleanup
   - In this environment the handler can receive a string ('SIGINT')
   - Next calls process.exit(code), Node expects a number -> crash
   This blocks SIGINT/SIGTERM handler registration and guards process.exit.
*/

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
