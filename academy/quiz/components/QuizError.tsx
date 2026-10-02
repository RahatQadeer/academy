import { Callout } from "@/base/components/Callout";
import type { LearnerQuizUnavailableReason } from "../types";
import { learnerQuizMessage } from "../utils/messages";

export function QuizError({ reason }: { reason: LearnerQuizUnavailableReason }) {
  return (
    <Callout tone="warning" title="Quiz unavailable">
      {learnerQuizMessage(reason)}
    </Callout>
  );
}
