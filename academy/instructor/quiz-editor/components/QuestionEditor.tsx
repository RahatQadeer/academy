import { Input } from "@/base/components/Input";
import type { AcademyQuestionType } from "@/academy/lib/domain";
import type { EditorQuestion } from "../types";
import { QUESTION_TEXT_MAX } from "../types";
import { TRUE_FALSE_OPTIONS } from "../utils/validation";
import { MultipleChoiceEditor } from "./MultipleChoiceEditor";
import { QuestionTypeSelector } from "./QuestionTypeSelector";
import { TrueFalseEditor } from "./TrueFalseEditor";

export function QuestionEditor({
  question,
  groupKey,
  disabled,
  onChange,
}: {
  question: EditorQuestion;
  groupKey: string;
  disabled?: boolean;
  onChange: (patch: Partial<EditorQuestion>) => void;
}) {
  function changeType(type: AcademyQuestionType) {
    if (type === "true_false") {
      onChange({
        type,
        options: TRUE_FALSE_OPTIONS,
        correctAnswer: question.correctAnswer === "false" ? "false" : "true",
      });
      return;
    }
    const options =
      question.options.length >= 2
        ? question.options
        : [
            { id: "opt-a", label: "Option A" },
            { id: "opt-b", label: "Option B" },
          ];
    onChange({
      type,
      options,
      correctAnswer: options.some((item) => item.id === question.correctAnswer)
        ? question.correctAnswer
        : options[0]?.id ?? "",
    });
  }

  return (
    <div className="space-y-4">
      <Input
        label="Question"
        name="question-text"
        value={question.questionText}
        maxLength={QUESTION_TEXT_MAX}
        disabled={disabled}
        onChange={(event) => onChange({ questionText: event.target.value })}
      />
      <QuestionTypeSelector value={question.type} disabled={disabled} onChange={changeType} />
      {question.type === "true_false" ? (
        <TrueFalseEditor
          name={`tf-${groupKey}`}
          correctAnswer={question.correctAnswer}
          disabled={disabled}
          onChange={(correctAnswer) => onChange({ correctAnswer })}
        />
      ) : (
        <MultipleChoiceEditor
          groupName={`mc-${groupKey}`}
          options={question.options}
          correctAnswer={question.correctAnswer}
          disabled={disabled}
          onChangeOptions={(options) => onChange({ options })}
          onChangeCorrect={(correctAnswer) => onChange({ correctAnswer })}
        />
      )}
    </div>
  );
}
