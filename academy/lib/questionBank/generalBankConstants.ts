/** Shared pool for bank questions not tied to a real catalog course. */
export const GENERAL_BANK_PROGRAM_NAME = "General questions";
export const GENERAL_BANK_CATEGORY = "__question_bank_general__";

export function isGeneralBankProgram(row: {
  name?: string | null;
  category?: string | null;
}) {
  return row.category === GENERAL_BANK_CATEGORY || row.name === GENERAL_BANK_PROGRAM_NAME;
}
