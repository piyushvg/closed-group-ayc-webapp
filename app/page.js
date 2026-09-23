import { redirect } from "next/navigation";

// Members land on their own portal now. The middleware bounces them to
// /login if they aren't signed in, so this one line covers both cases.
// /register still exists for the office to add brand-new members.
export default function Home() {
  redirect("/portal");
}