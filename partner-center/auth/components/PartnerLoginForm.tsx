"use client";

import { LoginForm } from "@/base/auth/LoginForm";

export function PartnerLoginForm() {
  return (
    <div className="[&_form>p:last-child]:hidden">
      <LoginForm nextPath="/partner-center" />
    </div>
  );
}
