/** Starts a promise from an event handler, which is not allowed to return one. */
const forget = (pending: Promise<void>): void => {
  // oxlint-disable-next-line eslint/no-void -- a handler has to drop the promise here
  void pending;
};

export { forget };
