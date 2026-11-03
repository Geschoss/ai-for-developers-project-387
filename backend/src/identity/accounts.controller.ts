import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { components } from "spec/api";

import { AccountsService } from "./accounts.service.js";
import { clearedSessionCookie, sessionCookie, sessionIdFrom } from "./session-cookie.js";

@Controller("auth")
export class AccountsController {
  public constructor(@Inject(AccountsService) private readonly accounts: AccountsService) {}

  @Post("register")
  @HttpCode(201)
  public async register(
    @Body() registration: components["schemas"]["OwnerRegistration"],
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<components["schemas"]["CurrentOwner"]> {
    const started = await this.accounts.register(registration);
    response.setHeader("Set-Cookie", sessionCookie(started.sessionId, request.secure));
    return started.user;
  }

  @Post("login")
  // Nest answers POST with 201 unless told otherwise. Login is 200 in the spec.
  @HttpCode(200)
  public async logIn(
    @Body() credentials: components["schemas"]["Credentials"],
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<components["schemas"]["CurrentUser"]> {
    const started = await this.accounts.logIn(credentials);
    response.setHeader("Set-Cookie", sessionCookie(started.sessionId, request.secure));
    return started.user;
  }

  @Post("logout")
  @HttpCode(204)
  public async logOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.accounts.logOut(sessionIdFrom(request));
    response.setHeader("Set-Cookie", clearedSessionCookie(request.secure));
  }

  @Get("me")
  public async currentUser(@Req() request: Request): Promise<components["schemas"]["CurrentUser"]> {
    const user = await this.accounts.currentUser(sessionIdFrom(request));
    return user;
  }
}
