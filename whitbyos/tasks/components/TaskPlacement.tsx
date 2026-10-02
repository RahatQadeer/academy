"use client";

import { useState } from "react";
import type { PlanStreams } from "@/whitbyos/lib/tasks";

const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-[13.5px]";

const LABEL = "mb-1.5 block text-[12px] font-medium uppercase tracking-[0.06em]";

export type RequestOption = {
  id: string;
  title: string;
  clientId: string | null;
};

/**
 * Whose work it is, then which plan, then where in it, then which request.
 *
 * Every one of these used to be its own select over everything in the
 * workspace, so the form would happily offer Rohail Khan's name above another
 * client's Work Plan and a third client's Request. It also meant one select of
 * every plan crossed with every stream: ninety-five lines of "Plan · Stream",
 * unsorted, each plan's name repeated five times down it.
 *
 * Each answer narrows the next, which is the order somebody thinks in and the
 * only order in which the combinations are all real. Changing one clears what
 * came after it, rather than leaving the last client's answer standing under
 * the new one's name.
 */
export function TaskPlacement({
  clients,
  plans,
  requests,
  openClientId,
  openRequestId,
}: {
  clients: { id: string; name: string }[];
  plans: PlanStreams[];
  requests: RequestOption[];
  /**
   * The Request this was opened from, where it was opened from one.
   *
   * A task made out of a conversation about the Lagos move belongs to the
   * Lagos move: the form starts there, and starts on that Request's plan
   * where there is exactly one, rather than asking again for what the screen
   * behind it already said.
   */
  openRequestId?: string | null;
  /**
   * The client workspace that is open, which is whose work this is.
   *
   * Chosen once on Workspace Overview and answered the same way everywhere,
   * so this form starts on it rather than making somebody name the client
   * they are already inside. With "All clients" open there is nothing to
   * assume and the full list is the question.
   */
  openClientId?: string | null;
}) {
  const [clientId, setClientId] = useState(() => {
    if (openClientId && clients.some((client) => client.id === openClientId)) return openClientId;
    return clients.length === 1 ? clients[0].id : "";
  });

  const [planId, setPlanId] = useState(() => {
    const forRequest = openRequestId
      ? plans.filter((plan) => plan.requestId === openRequestId)
      : [];

    if (forRequest.length === 1) return forRequest[0].id;
    return plans.length === 1 ? plans[0].id : "";
  });

  // Whose work this is narrows what comes after it.
  const forClient = clientId
    ? plans.filter((plan) => plan.clientId === clientId)
    : plans;
  const chosen = forClient.find((plan) => plan.id === planId);

  const askable = clientId
    ? requests.filter((request) => request.clientId === clientId)
    : requests;

  return (
    <>
      {/* 16z asks for the client before the Request, because a task may belong
          to a client without belonging to any one piece of work. */}
      {clients.length > 0 ? (
      <Field label="Client / Workspace" htmlFor="client_id">
        <select
          id="client_id"
          name="client_id"
          required
          value={clientId}
          onChange={(event) => {
            setClientId(event.currentTarget.value);
            setPlanId("");
          }}
          className={CONTROL}
        >
          {/* A task is somebody's work. "No client" made one that belonged to
              nobody, which is the same hole "no Request" left. */}
          <option value="" disabled>
            Choose the workspace
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </Field>
      ) : null}

      <Field label="Where this belongs" htmlFor="workstream_id">
        <div className="flex flex-col gap-2">
          <select
            aria-label="Which Work Plan"
            value={chosen ? planId : ""}
            onChange={(event) => setPlanId(event.currentTarget.value)}
            disabled={forClient.length === 0}
            className={CONTROL}
          >
            <option value="" disabled>
              {forClient.length === 0
                ? "No Work Plan for this client yet"
                : "Choose the Work Plan"}
            </option>
            {forClient.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>

          <select
            id="workstream_id"
            name="workstream_id"
            required
            // Keyed on the plan, so choosing a different one clears the stream
            // rather than leaving the last plan's answer under a new name.
            key={planId}
            defaultValue=""
            disabled={!chosen}
            className={CONTROL}
            aria-label="Which Work Stream"
          >
            <option value="" disabled>
              {chosen ? "Choose the Work Stream" : "Choose a Work Plan first"}
            </option>
            {(chosen?.streams ?? []).map((stream) => (
              <option key={stream.id} value={stream.id}>
                {stream.name}
              </option>
            ))}
          </select>
        </div>

        <p className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)", margin: "4px 0 0" }}>
          Whitby writes the steps once it is added.
        </p>
      </Field>

      <Field label="Linked Request" htmlFor="request_id">
        <select
          id="request_id"
          name="request_id"
          key={clientId}
          required
          defaultValue={
            openRequestId && askable.some((request) => request.id === openRequestId)
              ? openRequestId
              : ""
          }
          className={CONTROL}
        >
          {/*
           * A task belongs to a Request, so this is no longer optional.
           *
           * With no client named, the empty value is the plan's own Request,
           * which is a Request: `createTask` files the task under it. With a
           * client named it meant no Request at all, and a task nobody's plan
           * and no client file lists is the thing that option kept producing;
           * it is offered now only where that client has no Request to pick,
           * which is a gap in their Requests rather than a choice.
           */}
          <option value="" disabled={Boolean(clientId) && askable.length > 0}>
            {clientId
              ? askable.length === 0
                ? "This client has no Requests yet"
                : "Choose a Request"
              : "The plan's own Request"}
          </option>
          {askable.map((request) => (
            <option key={request.id} value={request.id}>
              {request.title}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

/**
 * The Tasks dialogs label their fields a shade smaller and tighter than the
 * Work Plans ones, which is why this is here rather than the shared field.
 */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <label className={LABEL} htmlFor={htmlFor} style={{ color: "var(--text-tertiary)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
