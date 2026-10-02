"use client";

import type { CatalogPipelineEvent } from "@/academy/admin/catalog/lib/stages";

/**
 * POST a JSON body and consume the `text/event-stream` response.
 */
export async function streamPost(
  url: string,
  body: unknown,
  onEvent: (event: CatalogPipelineEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  if (!response.body) throw new Error("The server returned an empty response.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawTerminal = false;

  const consume = (chunk: string) => {
    const line = chunk.split("\n").find((entry) => entry.startsWith("data:"));
    if (!line) return;
    try {
      const event = JSON.parse(line.slice(5).trim()) as CatalogPipelineEvent;
      if (event.type === "done" || event.type === "error") sawTerminal = true;
      onEvent(event);
    } catch {
      /* ignore malformed frame */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    if (done) buffer += decoder.decode();

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
      consume(chunk);
    }

    if (done) {
      if (buffer.trim()) consume(buffer);
      break;
    }
  }

  if (!sawTerminal) {
    throw new Error(
      "The connection closed before Whitby finished saving. If a draft appears in your programs list, open it there — otherwise try again with fewer modules.",
    );
  }
}
