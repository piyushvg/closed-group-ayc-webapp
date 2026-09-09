"use client";

import MemberProfileForm from "../../components/MemberProfileForm";

export default function RegisterPage() {
  return (
    <MemberProfileForm
      apiEndpoint="/api/member"
      onSaved={(result) => {
        // Runs after a successful save — result is whatever the backend
        // returned (e.g. { member_id: "MEM-000123" }).
        console.log("Member saved:", result);
        // TODO: redirect to a success page or member list once you have one, e.g.:
        // router.push(`/members/${result.member_id}`);
      }}
    />
  );
}