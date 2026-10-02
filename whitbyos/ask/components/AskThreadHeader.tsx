"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AskChatMenu } from "@/whitbyos/ask/components/AskChatMenu";
import { askThreadLabel } from "@/whitbyos/lib/ask-format";

/** Thread top bar: soft glass title strip + ··· (dark menu for rename / delete). */
export function AskThreadHeader({
  threadId,
  title,
}: {
  threadId: string;
  title: string;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(askThreadLabel(title));

  return (
    <header className="ask-thread-header">
      <h1 className="ask-thread-title min-w-0 flex-1 truncate">{label}</h1>
      <AskChatMenu
        threadId={threadId}
        title={label}
        align="right"
        triggerClassName="ask-thread-menu-btn"
        onRenamed={(_id, next) => setLabel(askThreadLabel(next))}
        onDeleted={() => router.replace("/whitbyos/ask")}
      />
    </header>
  );
}
