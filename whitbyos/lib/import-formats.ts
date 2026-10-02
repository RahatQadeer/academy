/**
 * Which files WP.12 takes — shared by the upload panel and the parser.
 *
 * Its own module, and free of `server-only`, because the panel that offers the
 * formats runs in the browser and the code that reads them runs on the server.
 * If these lived with the parsers, the file picker would offer a format the
 * moment someone removed one, or refuse one still supported.
 */

export type ImportFormat = "text" | "docx" | "xlsx" | "pdf";

const BY_EXTENSION: Array<[RegExp, ImportFormat]> = [
  [/\.(txt|md|markdown|csv|tsv|json)$/, "text"],
  [/\.docx$/, "docx"],
  [/\.(xlsx|xlsm)$/, "xlsx"],
  [/\.pdf$/, "pdf"],
];

const BY_TYPE: Array<[(type: string) => boolean, ImportFormat]> = [
  [(type) => type.startsWith("text/") || type === "application/json", "text"],
  [(type) => type === "application/pdf", "pdf"],
  [(type) => type.includes("wordprocessingml"), "docx"],
  [(type) => type.includes("spreadsheetml"), "xlsx"],
];

/** The formats WP.12's upload panel promises, in the order it lists them. */
export const ACCEPTED_EXTENSIONS = ".pdf,.docx,.xlsx,.xlsm,.csv,.tsv,.txt,.md,.json";

/** Bigger than this and the model would only see the first slice anyway. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Which parser a file gets.
 *
 * Extension first, MIME second. Browsers disagree about the Office types —
 * some send the long OpenXML string, some `application/octet-stream`, and a
 * file dragged out of a zip can arrive with nothing at all — but the extension
 * survives all of that.
 */
export function formatOf(file: { name: string; type: string }): ImportFormat | null {
  const name = file.name.toLowerCase();
  for (const [pattern, format] of BY_EXTENSION) if (pattern.test(name)) return format;
  for (const [matches, format] of BY_TYPE) if (matches(file.type)) return format;
  return null;
}
