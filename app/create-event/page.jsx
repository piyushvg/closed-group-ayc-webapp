// app/create-event/page.js
//
// Server component: the board check happens before anything renders, so a
// non-board member never even sees the form skeleton. The API route checks
// again on submit — see app/api/event/route.js.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AppHeader from "@/components/AppHeader";
import CreateEventForm from "@/components/CreateEventForm";

export default async function CreateEventPage() {
  const session = await getSession();

  if (!session) redirect("/login");

  if (!session.isBoardMember) {
    return (
      <div style={styles.outer}>
        <AppHeader mobileNo={session.mobileNo} />
        <div style={styles.box}>
          <h1 style={styles.title}>Board members only</h1>
          <p style={styles.text}>
            Events are created by the board. If you think you should have access,
            please contact the club office.
          </p>
          <a href="/portal" style={styles.link}>
            Back to my profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.outer}>
      <AppHeader mobileNo={session.mobileNo} />
      <CreateEventForm />
    </div>
  );
}

const styles = {
  outer: {
    minHeight: "100vh",
    background: "#FAF9F5",
    color: "#2B2A27",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  box: {
    maxWidth: 520,
    margin: "80px auto",
    padding: "28px 26px",
    background: "#FFFFFF",
    border: "1px solid #D8D5CB",
    borderRadius: 12,
    textAlign: "center",
  },
  title: { fontSize: 19, fontWeight: 600, margin: "0 0 8px" },
  text: { fontSize: 13.5, color: "#7A776E", margin: "0 0 18px", lineHeight: 1.5 },
  link: { fontSize: 13.5, color: "#B3413A", fontWeight: 600, textDecoration: "none" },
};