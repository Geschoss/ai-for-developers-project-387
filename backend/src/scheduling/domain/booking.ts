/** A stored Бронирование. The Гость's name and email stay plain strings. */
interface StoredBooking {
  endAt: Date;
  eventTypeId: string;
  guestEmail: string;
  guestName: string;
  id: string;
  note: string | null;
  startAt: Date;
}

interface Interval {
  end: Date;
  start: Date;
}

/** Half-open `[start, end)` overlaps another. A shared endpoint does not. */
const intervalsOverlap = (left: Interval, right: Interval): boolean =>
  left.start.getTime() < right.end.getTime() && left.end.getTime() > right.start.getTime();

class Booking {
  public readonly endAt: Date;
  public readonly eventTypeId: string;
  public readonly guestEmail: string;
  public readonly guestName: string;
  public readonly id: string;
  public readonly note: string | null;
  public readonly startAt: Date;

  public constructor(booking: StoredBooking) {
    this.endAt = booking.endAt;
    this.eventTypeId = booking.eventTypeId;
    this.guestEmail = booking.guestEmail;
    this.guestName = booking.guestName;
    this.id = booking.id;
    this.note = booking.note;
    this.startAt = booking.startAt;
  }
}

export { Booking, type StoredBooking, intervalsOverlap };
