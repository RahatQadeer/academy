"use client";

/**
 * Self-animating product scenes for the Notion-style landing page.
 * All motion is CSS keyframes; scenes start when `.notion-in-view` is
 * present on an ancestor (see NotionReveal) and respect reduced motion.
 */

import { IconCheck, IconWhitby } from "@/base/landing/brand/Icons";
import { cn } from "@/base/lib/cn";

function Cursor({ className }: { className?: string }) {
  return (
    <svg
      className={cn("notion-cursor", className)}
      width="18"
      height="20"
      viewBox="0 0 18 20"
      aria-hidden
    >
      <path
        d="M2 1.5 15.5 9.8 9.6 11.3 6.8 17.3 2 1.5Z"
        fill="#37352f"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WindowChrome({ title }: { title: string }) {
  return (
    <div className="notion-scene-chrome">
      <span className="notion-scene-dot" />
      <span className="notion-scene-dot" />
      <span className="notion-scene-dot" />
      <span className="notion-scene-chrome-title">{title}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: prompt typed → Whitby drafts a plan, tasks tick, cursor clicks */
/* ------------------------------------------------------------------ */

const PLAN_LINES = [
  "Draft relocation timeline",
  "Confirm tax residency triggers",
  "Approve moving budget",
  "Schedule shipping & customs",
];

export function PlanScene({ className }: { className?: string }) {
  return (
    <div className={cn("notion-scene notion-scene--plan", className)} aria-hidden>
      <WindowChrome title="Whitby — Work plan" />
      <div className="notion-scene-body">
        <div className="notion-typing">
          <IconWhitby size={13} />
          <span className="notion-typing-text">
            Plan a relocation to Geneva for a family of four
          </span>
          <span className="notion-typing-caret" />
        </div>
        <ul className="notion-plan-list">
          {PLAN_LINES.map((line, i) => (
            <li
              key={line}
              className="notion-plan-item"
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className="notion-plan-check">
                <IconCheck size={9} strokeWidth={3} />
              </span>
              <span className="notion-plan-text">{line}</span>
              <span
                className={cn("notion-plan-tag", i === 2 && "notion-plan-tag--approval")}
              >
                {i === 2 ? "Approval" : "Auto"}
              </span>
            </li>
          ))}
        </ul>
        <div className="notion-plan-progress">
          <span className="notion-plan-progress-bar" />
        </div>
      </div>
      <Cursor className="notion-cursor--plan" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Portal: request statuses flip, a new message slides in              */
/* ------------------------------------------------------------------ */

const PORTAL_ROWS = [
  { title: "Zurich → Austin relocation", from: "In progress", to: "On track" },
  { title: "Q3 board packet", from: "Awaiting approval", to: "Approved" },
  { title: "Aspen residence opening", from: "Scheduled", to: "Scheduled" },
];

export function PortalScene({ className }: { className?: string }) {
  return (
    <div className={cn("notion-scene notion-scene--portal", className)} aria-hidden>
      <WindowChrome title="Client Portal" />
      <div className="notion-scene-body">
        {PORTAL_ROWS.map((row, i) => (
          <div
            key={row.title}
            className="notion-portal-row"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="notion-portal-title">{row.title}</span>
            <span className="notion-portal-status">
              <span className="notion-portal-status-from">{row.from}</span>
              <span className="notion-portal-status-to">{row.to}</span>
            </span>
          </div>
        ))}
        <div className="notion-portal-message">
          <span className="notion-portal-avatar">W</span>
          <span className="notion-portal-bubble">
            Customs paperwork is pre-filled — one signature needed.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Partner: referral card travels through the pipeline                  */
/* ------------------------------------------------------------------ */

const STAGES = ["Submit", "Qualify", "Convert", "Paid"];

export function PipelineScene({ className }: { className?: string }) {
  return (
    <div className={cn("notion-scene notion-scene--pipeline", className)} aria-hidden>
      <WindowChrome title="Partner Center — Referrals" />
      <div className="notion-scene-body">
        <div className="notion-pipeline">
          {STAGES.map((stage, i) => (
            <div
              key={stage}
              className="notion-pipeline-col"
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className="notion-pipeline-label">{stage}</span>
              <span className="notion-pipeline-slot" />
            </div>
          ))}
          <div className="notion-pipeline-card">
            <span className="notion-pipeline-card-title">Family office, Geneva</span>
            <span className="notion-pipeline-card-meta">$3,400 commission</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Academy: progress fills, credential badge pops                       */
/* ------------------------------------------------------------------ */

export function CredentialScene({ className }: { className?: string }) {
  return (
    <div className={cn("notion-scene notion-scene--credential", className)} aria-hidden>
      <WindowChrome title="Academy — Principal Affairs" />
      <div className="notion-scene-body">
        <div className="notion-cred-row">
          <span>Learning modules</span>
          <span className="notion-cred-bar">
            <span className="notion-cred-fill notion-cred-fill--a" />
          </span>
        </div>
        <div className="notion-cred-row">
          <span>Applied work</span>
          <span className="notion-cred-bar">
            <span className="notion-cred-fill notion-cred-fill--b" />
          </span>
        </div>
        <div className="notion-cred-row">
          <span>Proctored assessment</span>
          <span className="notion-cred-bar">
            <span className="notion-cred-fill notion-cred-fill--c" />
          </span>
        </div>
        <div className="notion-cred-badge">
          <IconCheck size={12} strokeWidth={3} />
          Certified Private Attaché
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coordination: three connected surfaces pulse & pass a packet along   */
/* ------------------------------------------------------------------ */

export function FlowScene({ className }: { className?: string }) {
  return (
    <div className={cn("notion-scene notion-scene--flow", className)} aria-hidden>
      <div className="notion-flow">
        <div className="notion-flow-node notion-flow-node--a">
          <span className="notion-flow-node-label">Request</span>
        </div>
        <span className="notion-flow-line">
          <span className="notion-flow-packet" />
        </span>
        <div className="notion-flow-node notion-flow-node--b">
          <IconWhitby size={14} />
          <span className="notion-flow-node-label">Whitby</span>
        </div>
        <span className="notion-flow-line notion-flow-line--2">
          <span className="notion-flow-packet notion-flow-packet--2" />
        </span>
        <div className="notion-flow-node notion-flow-node--c">
          <span className="notion-flow-node-label">Approver</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VA picker: choose an assistant to build & execute the plan           */
/* ------------------------------------------------------------------ */

const VA_ROWS = [
  {
    initials: "MR",
    name: "Maya R.",
    specialty: "Travel & Global Mobility",
    active: true,
  },
  {
    initials: "JK",
    name: "Jordan K.",
    specialty: "Family Office Operations",
    active: false,
  },
  {
    initials: "ES",
    name: "Elena S.",
    specialty: "Residence Operations",
    active: false,
  },
] as const;

export function VaPickerScene({ className }: { className?: string }) {
  return (
    <div className={cn("notion-scene notion-scene--va", className)} aria-hidden>
      <WindowChrome title="Whitby — Assign a VA" />
      <div className="notion-scene-body">
        <p className="notion-va-prompt">
          Choose who builds and executes this plan
        </p>
        <ul className="notion-va-list">
          {VA_ROWS.map((va, i) => (
            <li
              key={va.name}
              className={cn("notion-va-row", va.active && "notion-va-row--active")}
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className="notion-va-avatar">{va.initials}</span>
              <span className="notion-va-copy">
                <span className="notion-va-name">{va.name}</span>
                <span className="notion-va-specialty">{va.specialty}</span>
              </span>
              {va.active ? (
                <span className="notion-va-pill">Selected</span>
              ) : (
                <span className="notion-va-pill notion-va-pill--ghost">Choose</span>
              )}
            </li>
          ))}
        </ul>
        <div className="notion-va-footer">
          <IconWhitby size={12} />
          <span>Maya drafts beside Whitby — you still approve sensitive steps.</span>
        </div>
      </div>
      <Cursor className="notion-cursor--va" />
    </div>
  );
}
