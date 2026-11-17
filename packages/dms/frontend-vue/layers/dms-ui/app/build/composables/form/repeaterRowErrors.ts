import { escapeRegExp } from "./formEntryContext";

const ROW_CELL = /^(\d+)(\..+)$/;

/**
 * The errors a check of a repeater field `name` replaces: the field's own
 * (`name`) and those of the cells of the rows at `rows` (`name.<row>.<cell>`),
 * none of another row's.
 */
export function repeaterRowsPattern(
  name: string,
  rows: readonly number[],
): RegExp {
  const field = escapeRegExp(name);
  if (!rows.length) return new RegExp(`^${field}$`);
  return new RegExp(`^${field}(?:$|\\.(?:${rows.join("|")})\\.)`);
}

/**
 * The name of an error of repeater field `name` once its rows moved:
 * `indexAfter` gives the index a row now holds from the one it held, `-1`
 * for a removed row. A cell error follows its row, a removed row's is
 * `null`; any other error keeps its name.
 */
export function repeaterRowErrorName(
  name: string,
  errorName: string | undefined,
  indexAfter: (index: number) => number,
): string | null | undefined {
  const prefix = `${name}.`;
  if (!errorName?.startsWith(prefix)) return errorName;
  const cell = ROW_CELL.exec(errorName.slice(prefix.length));
  if (!cell) return errorName;
  const after = indexAfter(Number(cell[1]));
  return after < 0 ? null : `${prefix}${after}${cell[2]}`;
}
