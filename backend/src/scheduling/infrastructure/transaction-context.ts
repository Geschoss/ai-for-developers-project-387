import { AsyncLocalStorage } from "node:async_hooks";

import type { Database } from "../../platform/database/database.module.js";

/** The client Drizzle hands to a `transaction` callback: same queries, one locked unit of work. */
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const transactionStorage = new AsyncLocalStorage<Transaction>();

/** The transaction opened by the scheduling UnitOfWork. Writes have no other connection. */
const currentTransaction = (): Transaction => {
  const transaction = transactionStorage.getStore();
  if (transaction === undefined) {
    throw new Error("Календарь is loaded outside a UnitOfWork");
  }
  return transaction;
};

export { type Transaction, currentTransaction, transactionStorage };
