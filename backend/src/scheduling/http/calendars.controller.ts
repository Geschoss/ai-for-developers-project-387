import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import type { components } from "spec/api";

import { AccountsService } from "../../identity/accounts.service.js";
import { sessionIdFrom } from "../../identity/session-cookie.js";
import { CALENDAR_ROUTES, type CalendarRoutes } from "./calendar-routes.js";
import { publishedType } from "./published-type.js";
import { translateScheduling } from "./scheduling-problem.js";
import { viewerFrom } from "./viewer-from.js";

type BookingConfirmation = components["schemas"]["BookingConfirmation"];
type BookingRequest = components["schemas"]["BookingRequest"];
type PublicCalendar = components["schemas"]["PublicCalendar"];
type SlotList = components["schemas"]["SlotList"];

@Controller("calendars")
export class CalendarsController {
  public constructor(
    @Inject(CALENDAR_ROUTES) private readonly routes: CalendarRoutes,
    @Inject(AccountsService) private readonly accounts: AccountsService,
  ) {}

  @Get(":calendarSlug")
  public async getPublic(@Param("calendarSlug") calendarSlug: string): Promise<PublicCalendar> {
    const calendar = await translateScheduling(this.routes.publicCalendar.execute(calendarSlug));
    return {
      ...calendar,
      eventTypes: calendar.eventTypes.map((eventType) => publishedType(eventType)),
    };
  }

  @Post(":calendarSlug/bookings")
  @HttpCode(201)
  public async createBooking(
    @Param("calendarSlug") calendarSlug: string,
    @Body() booking: BookingRequest,
    @Req() request: Request,
  ): Promise<BookingConfirmation> {
    const viewer = await viewerFrom(this.accounts, sessionIdFrom(request));
    const confirmation = await translateScheduling(
      this.routes.bookSlot.execute(calendarSlug, booking, viewer),
    );
    return confirmation;
  }

  @Get(":calendarSlug/slots")
  public async listSlots(
    @Param("calendarSlug") calendarSlug: string,
    @Query() query: { eventTypeId: string; from: string; to: string },
  ): Promise<SlotList> {
    const slots = await translateScheduling(
      this.routes.listSlots.execute({
        calendarSlug,
        eventTypeId: query.eventTypeId,
        from: new Date(query.from),
        to: new Date(query.to),
      }),
    );
    return slots;
  }
}
