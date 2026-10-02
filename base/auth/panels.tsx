import { AuthPanel } from "@/base/components/AuthLayout";

/**
 * The dark column on each signed-out screen, screen by screen.
 *
 * The export does not repeat one panel nine times. Each screen argues the
 * thing that matters at that moment: the sign-in error talks about the cost of
 * a mistake, the reset screen talks about how passwords are stored, and the
 * 2FA screen talks about sessions. Collapsing them into one panel would lose
 * the reason each screen has its own.
 */

/** Screen 1's request card, drawn in the panel above the claims. */
function RequestCard() {
  const bars = [
    { label: "Visa filing", width: "82%", colour: "#5b9ee6" },
    { label: "School tour", width: "46%", colour: "#e0a940" },
    { label: "Lease sign", width: "100%", colour: "#8ecb9e" },
  ];

  return (
    <div
      className="mt-1.5 w-full max-w-[480px] rounded-[12px] p-4"
      style={{
        // Lit from its own top-left rather than filled flat, so the card sits
        // in the panel's light instead of on top of it.
        background:
          "linear-gradient(155deg, rgba(255,255,255,.07), rgba(255,255,255,.02) 46%, rgba(255,255,255,0))",
        border: "1px solid rgba(255,255,255,.14)",
        boxShadow: "0 22px 50px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.07)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,.8)" }}>
          Hartwell Family, Requests
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ color: "#8ecb9e", background: "rgba(142,203,158,.15)" }}
        >
          On track
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {bars.map((bar, index) => (
          <div key={bar.label} className="flex items-center gap-2.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: bar.colour, boxShadow: `0 0 8px ${bar.colour}` }}
            />
            <span
              className="h-1.5 flex-1 overflow-hidden rounded-[3px]"
              style={{ background: "rgba(255,255,255,.1)" }}
            >
              {/* Fills to its width rather than being drawn already full, one
                  after another — the card shows work moving, which is the one
                  thing a screenshot of it cannot. */}
              <span
                className="pa-auth-bar block h-full rounded-[3px]"
                style={{
                  width: bar.width,
                  background: bar.colour,
                  animationDelay: `${260 + index * 130}ms`,
                }}
              />
            </span>
            <span className="w-[60px] shrink-0 text-[10.5px]" style={{ color: "rgba(255,255,255,.5)" }}>
              {bar.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex items-center gap-1.5">
        {["#5e8ec2", "#a173d1", "#c98a4e"].map((colour, index) => (
          <span
            key={colour}
            className="h-5 w-5 rounded-full"
            style={{
              background: colour,
              border: "2px solid #2b2925",
              marginLeft: index === 0 ? 0 : -10,
            }}
          />
        ))}
        <span className="ml-1.5 text-[10.5px]" style={{ color: "rgba(255,255,255,.45)" }}>
          Jordan + 2 teammates
        </span>
      </div>
    </div>
  );
}

/** Screen 2's drafted plan, the thing Whitby hands you before onboarding ends. */
function DraftedPlanCard() {
  const streams = [
    { name: "Housing search & lease review", done: true },
    { name: "Visa & immigration filing", done: true },
    { name: "Schooling placement", done: false },
    { name: "Banking & account transfer", done: false },
  ];

  return (
    <div
      className="mt-1.5 w-full max-w-[480px] rounded-[10px] p-4"
      style={{
        background: "#2b2925",
        border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "0 16px 40px rgba(0,0,0,.28)",
      }}
    >
      <div
        className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.04em]"
        style={{ color: "#5b9ee6" }}
      >
        Drafted by Whitby
      </div>
      <div className="mb-3 text-[14px] font-semibold" style={{ color: "#fff" }}>
        NYC to London Relocation
      </div>

      <div className="flex flex-col gap-2">
        {streams.map((stream) => (
          <span
            key={stream.name}
            className="flex items-center gap-2 text-[12.5px]"
            style={{ color: stream.done ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.4)" }}
          >
            <span style={{ color: stream.done ? "#8ecb9e" : "rgba(255,255,255,.25)" }}>
              {stream.done ? "✓" : "○"}
            </span>
            {stream.name}
          </span>
        ))}
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-[3px]"
        style={{ background: "rgba(255,255,255,.1)" }}
      >
        <span className="block h-full w-[45%]" style={{ background: "#e0a940" }} />
      </div>
      <div className="mt-1.5 text-[10.5px]" style={{ color: "rgba(255,255,255,.45)" }}>
        2 of 4 work streams drafted
      </div>
    </div>
  );
}

export function SignInPanel() {
  return (
    <AuthPanel
      heading="The workspace for family office logistics."
      blurb="Every request, work plan and provider relationship in one place, with Whitby drafting the first pass so your team reviews rather than writes."
      claims={[
        { term: "Requests", detail: "Tracked start to finish" },
        { term: "Work Plans", detail: "Drafted by Whitby, approved by you" },
      ]}
    >
      <RequestCard />
    </AuthPanel>
  );
}

/** The professional invite: same argument as sign-in, aimed at joining a team. */
export function InvitePanel({ firmName }: { firmName?: string | null }) {
  return (
    <AuthPanel
      heading={
        firmName
          ? `Join ${firmName} on Whitby.`
          : "Join your team on Whitby."
      }
      blurb="Set a password to open the workspace you were invited to. Your role is already waiting."
      claims={[
        { term: "Requests", detail: "One shared queue" },
        { term: "Work Plans", detail: "Drafted, then reviewed" },
        { term: "Calendar", detail: "The whole team in view" },
      ]}
    >
      <RequestCard />
    </AuthPanel>
  );
}

/** 1.1 argues something different: what a mistake actually costs. */
export function SignInErrorPanel() {
  return (
    <AuthPanel
      heading="Built for the details that don't get a second chance."
      blurb="One mistyped visa deadline costs more than a support ticket ever will."
      claims={[
        { term: "Documents", detail: "Every version, every signature" },
        { term: "Deadlines", detail: "Nothing slips past the calendar" },
        { term: "Access", detail: "Only the right people, every time" },
      ]}
    />
  );
}

export function VerifyIdentityPanel() {
  return (
    <AuthPanel
      heading="Family office data deserves more than a password."
      blurb="Two-factor sign-in, session limits, and an audit trail on every login."
      claims={[
        { term: "2FA", detail: "Required workspace-wide" },
        { term: "Sessions", detail: "One active login at a time" },
        { term: "Audit", detail: "Every sign-in logged" },
      ]}
    />
  );
}

export function SignUpPanel() {
  return (
    <AuthPanel
      heading="Start the workspace your family office actually needs."
      blurb="Whitby drafts the first plan before you've finished onboarding."
      claims={[{ term: "Trial", detail: "14 days, no card required" }]}
    >
      <DraftedPlanCard />
    </AuthPanel>
  );
}

export function VerifyEmailPanel() {
  return (
    <AuthPanel
      heading="One more step before Whitby gets to work."
      blurb="Confirm your email to unlock your workspace and its first draft."
      claims={[
        { term: "Security", detail: "Verified access only" },
        { term: "Whitby", detail: "Drafting while you wait" },
        { term: "Team", detail: "Invite teammates after" },
      ]}
    />
  );
}

export function ForgotPasswordPanel() {
  return (
    <AuthPanel
      heading="Locked out happens. Losing the thread doesn't."
      blurb="Reset your password and your requests, plans and messages pick up right where you left them."
      claims={[
        { term: "Recovery", detail: "Reset link expires in 30 minutes" },
        { term: "Data", detail: "Nothing lost, nothing paused" },
        { term: "Support", detail: "Real people if you need them" },
      ]}
    />
  );
}

export function CheckEmailPanel() {
  return (
    <AuthPanel
      heading="Check your inbox, you're almost back in."
      blurb="We've sent a reset link. It's valid for the next 30 minutes."
      claims={[
        { term: "Delivery", detail: "Usually arrives in seconds" },
        { term: "Spam", detail: "Check spam if it's late" },
        { term: "Help", detail: "Contact support anytime" },
      ]}
    />
  );
}

export function ResetPasswordPanel() {
  return (
    <AuthPanel
      heading="Choose a password worth trusting with client data."
      blurb="Family office work means sensitive documents, financials and schedules. Start strong."
      claims={[
        { term: "Strength", detail: "12+ characters recommended" },
        { term: "Storage", detail: "Never stored in plain text" },
        { term: "2FA", detail: "Pairs with two-factor login" },
      ]}
    />
  );
}

/**
 * The end of the Verify Email flow, after the link in the email is followed.
 *
 * The export draws 2.1, the screen that asks somebody to go and check their
 * inbox, and stops there — it has no frame for the moment they come back. So
 * this speaks to where they actually are: confirmed, and about to see the
 * workspace for the first time. `VerifyEmailPanel` cannot be reused, since it
 * still asks for the thing that has just been done.
 */
export function ConfirmedPanel() {
  return (
    <AuthPanel
      heading="Confirmed. Your workspace is waiting."
      blurb="Everything from here on is yours to set up — clients, requests, and the first plan Whitby drafts."
      claims={[
        { term: "Email", detail: "Verified" },
        { term: "Workspace", detail: "Ready to open" },
        { term: "Next", detail: "Continue and set it up" },
      ]}
    />
  );
}

export function PasswordUpdatedPanel() {
  return (
    <AuthPanel
      heading="You're back in — nothing waiting on you slipped."
      blurb="Your password is updated. Sign in to pick up your requests and work plans."
      claims={[
        { term: "Status", detail: "All requests still on track" },
        { term: "Access", detail: "Signed out of other devices" },
        { term: "Next", detail: "Sign in to continue" },
      ]}
    />
  );
}
