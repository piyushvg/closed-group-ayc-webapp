import { NextResponse } from "next/server";

const FRAPPE_BASE_URL = process.env.FRAPPE_BASE_URL;
const FRAPPE_API_KEY = process.env.FRAPPE_API_KEY;
const FRAPPE_API_SECRET = process.env.FRAPPE_API_SECRET;

const CREATE_EVENT_PATH =
  "/api/method/community_circle_app.community_circle.api.event_api.create_event";

export async function POST(request) {
  try {
    const body = await request.json();

    const response = await fetch(
      `${FRAPPE_BASE_URL}${CREATE_EVENT_PATH}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `token ${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.exception ||
            data?.message ||
            "Failed to create event",
          details: data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Create event error:", error);

    return NextResponse.json(
      {
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}