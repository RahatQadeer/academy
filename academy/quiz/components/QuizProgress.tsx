export function QuizProgress({
  answered,
  total,
}: {
  answered: number;
  total: number;
}) {
  return (
    <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
      {answered} of {total} answered
    </p>
  );
}
