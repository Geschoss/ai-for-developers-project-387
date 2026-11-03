import { Inject, Injectable } from "@nestjs/common";

import { DATABASE, type Database } from "../../platform/database/database.module.js";
import type { UnitOfWork } from "../domain/ports/unit-of-work.js";
import { transactionStorage } from "./transaction-context.js";

/** One database transaction. The repository reads it from the async context, already locked by the load. */
@Injectable()
class DrizzleUnitOfWork implements UnitOfWork {
  public constructor(@Inject(DATABASE) private readonly db: Database) {}

  public async run<Result>(work: () => Promise<Result>): Promise<Result> {
    const result = await this.db.transaction(async (transaction) => {
      const value = await transactionStorage.run(transaction, work);
      return value;
    });
    return result;
  }
}

export { DrizzleUnitOfWork };
