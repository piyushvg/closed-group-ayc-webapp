// app/api/event/route.js
//
// Creating an event is a board-member action. The check lives HERE, not just
// in the UI — hiding the button only hides it; anyone can still POST to this
// route directly. Both layers exist, and this is the one that matters.

import { frappePost, FRAPPE_METHODS } from "@/lib/frappe";
import { getSession } from "@/lib/session";

export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return Response.json({ message: "Please sign in first." }, { status: 401 });
  }

  if (!session.isBoardMember) {
    return Response.json(
      { message: "Only board members can create events." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const eventName = String(body.event_name ?? "").trim();
    const eventDatetime = String(body.event_datetime ?? "").trim();
    const venue = String(body.venue ?? "").trim();

    if (!eventName || !eventDatetime || !venue) {
      return Response.json(
        { message: "Event name, date & time, and venue are required." },
        { status: 400 }
      );
    }

    const payload = {
      event_name: eventName,
      description: String(body.description ?? ""),
      // The browser's datetime-local gives "2026-12-15T18:00"; Frappe wants
      // a space and seconds.
      event_datetime: normalizeDatetime(eventDatetime),
      venue,
      organizers: String(body.organizers ?? ""),
      google_map_location: String(body.google_map_location ?? ""),
    };

    // Coordinates are optional — an event with no pin still saves.
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (body.latitude != null && body.longitude != null && !isNaN(lat) && !isNaN(lng)) {
      payload.latitude = lat;
      payload.longitude = lng;
    }

    // Useful for the backend to know who filed it; harmless if ignored.
    payload.created_by_member = session.memberId;

    const result = await frappePost(FRAPPE_METHODS.createEvent, payload);
    return Response.json(result ?? { ok: true });
  } catch (err) {
    return Response.json(
      { message: err.message || "Could not create the event." },
      { status: 500 }
    );
  }
}

/** "2026-12-15T18:00" → "2026-12-15 18:00:00" */
function normalizeDatetime(value) {
  const withSpace = value.replace("T", " ");
  return withSpace.length === 16 ? `${withSpace}:00` : withSpace;
}