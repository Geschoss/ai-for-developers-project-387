import { Inject, Injectable } from "@nestjs/common";

import { APP_OPTIONS, type AppOptions } from "../../app-options.js";
import type { Clock } from "../domain/ports/clock.js";

/** Production uses the wall clock. Tests pass `AppOptions.now` and every scenario reads it here. */
@Injectable()
class SystemClock implements Clock {
  public constructor(@Inject(APP_OPTIONS) private readonly options: AppOptions) {}

  public now(): Date {
    const clock = this.options.now;
    if (clock === undefined) {
      return new Date();
    }
    return clock();
  }
}

export { SystemClock };
