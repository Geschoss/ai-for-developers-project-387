import { Controller, Get, Inject, Req } from "@nestjs/common";
import type { Request } from "express";
import type { components } from "spec/api";

import { sessionIdFrom } from "../identity/session-cookie.js";
import { OwnerService } from "./owner.service.js";

type BookingList = components["schemas"]["BookingList"];

@Controller("owner")
export class OwnerController {
  public constructor(@Inject(OwnerService) private readonly owners: OwnerService) {}

  @Get("bookings")
  public async listUpcoming(@Req() request: Request): Promise<BookingList> {
    const upcoming = await this.owners.listUpcoming(sessionIdFrom(request));
    return { bookings: upcoming };
  }
}
