import { Controller, Get, Inject, Req } from "@nestjs/common";
import type { Request } from "express";
import type { components } from "spec/api";

import { AccountsService } from "../identity/accounts.service.js";
import { sessionIdFrom } from "../identity/session-cookie.js";
import { problem } from "../platform/problem.js";
import { AdminService } from "./admin.service.js";

@Controller("admin")
export class AdminController {
  public constructor(
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(AdminService) private readonly admin: AdminService,
  ) {}

  @Get("owners")
  public async listOwners(@Req() request: Request): Promise<components["schemas"]["OwnerList"]> {
    const user = await this.accounts.currentUser(sessionIdFrom(request));
    if (user.role !== "admin") {
      throw problem(403, "forbidden");
    }
    const owners = await this.admin.listOwners();
    return { owners };
  }
}
