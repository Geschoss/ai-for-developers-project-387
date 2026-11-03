import { Body, Controller, Get, HttpCode, Inject, Post, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import type { components } from "spec/api";

import { AccountsService } from "../../identity/accounts.service.js";
import { sessionIdFrom } from "../../identity/session-cookie.js";
import { CalendarSettingsService } from "../application/calendar-settings.js";
import { EventTypes } from "../application/event-types.js";
import { publishedType } from "./published-type.js";
import { translateScheduling } from "./scheduling-problem.js";

type EventType = components["schemas"]["EventType"];
type EventTypeList = components["schemas"]["EventTypeList"];
type NewEventType = components["schemas"]["NewEventType"];
type OwnerSettings = components["schemas"]["OwnerSettings"];

@Controller("owner")
export class CalendarSettingsController {
  public constructor(
    @Inject(CalendarSettingsService) private readonly settings: CalendarSettingsService,
    @Inject(EventTypes) private readonly eventTypes: EventTypes,
    @Inject(AccountsService) private readonly accounts: AccountsService,
  ) {}

  @Get("settings")
  public async getSettings(@Req() request: Request): Promise<OwnerSettings> {
    const owner = await this.accounts.requireOwnerViewer(sessionIdFrom(request));
    const settings = await translateScheduling(this.settings.get(owner.id));
    return settings;
  }

  @Put("settings")
  public async updateSettings(
    @Body() settings: OwnerSettings,
    @Req() request: Request,
  ): Promise<OwnerSettings> {
    const owner = await this.accounts.requireOwnerViewer(sessionIdFrom(request));
    const saved = await translateScheduling(this.settings.update(owner.id, settings));
    return saved;
  }

  @Get("event-types")
  public async listEventTypes(@Req() request: Request): Promise<EventTypeList> {
    const owner = await this.accounts.requireOwnerViewer(sessionIdFrom(request));
    const eventTypes = await translateScheduling(this.eventTypes.list(owner.id));
    return { eventTypes: eventTypes.map((eventType) => publishedType(eventType)) };
  }

  @Post("event-types")
  @HttpCode(201)
  public async createEventType(
    @Body() draft: NewEventType,
    @Req() request: Request,
  ): Promise<EventType> {
    const owner = await this.accounts.requireOwnerViewer(sessionIdFrom(request));
    const created = await translateScheduling(this.eventTypes.create(owner.id, draft));
    return publishedType(created);
  }
}
