import type { DataTypeFormatter } from "#dms-core/app/composables/data-types/useDataType";
import { isBoolean, isNumber, isString } from "#dms-core/app/utils/type-check";
import type { FormFieldValue } from "../../../composables/form/types/value";
import { cloneFormValue } from "./useFormModel";

/** A row of a repeater: a value per column. */
export type RepeaterRow = NonNullable<Parameters<DataTypeFormatter>[3]>;

/**
 * A cell's placeholder chosen by the value of another cell of its row, as
 * `ArrayItemField.placeholderFrom` declares it.
 */
export interface RepeaterPlaceholderFrom {
  field: string;
  map: Record<string, string>;
  /** When the other cell holds no value; `fallback` without it. */
  empty?: string;
  /** When the other cell holds a value `map` has no entry for. */
  fallback?: string;
}

/** What a repeater column declares for a new row. */
interface NewRowColumn {
  id: string;
  defaultValue?: FormFieldValue;
}

/**
 * A row as the user adds it: each column that declares a `defaultValue`
 * holds a copy of it, the others nothing.
 */
export function newRepeaterRow(columns: readonly NewRowColumn[]): RepeaterRow {
  const row: RepeaterRow = {};
  for (const column of columns) {
    if (column.defaultValue === undefined) continue;
    row[column.id] = cloneFormValue(column.defaultValue);
  }
  return row;
}

/** Whether a cell holds no value: nothing, an empty text or an empty list. */
function isEmptyCell(value: RepeaterRow[string]): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && !value.length)
  );
}

/** The text a cell's value is looked up by in a `map`: a scalar's. */
function lookupKey(value: RepeaterRow[string]): string | undefined {
  if (isString(value)) return value;
  if (isNumber(value) || isBoolean(value)) return String(value);
  return undefined;
}

/**
 * The placeholder `rule` picks in `row`: the entry of `map` for the text of
 * the other cell's value, `empty` (else `fallback`) when that cell holds no
 * value, `fallback` for a value `map` lacks; `undefined` keeps the cell's own.
 */
export function repeaterCellPlaceholder(
  rule: RepeaterPlaceholderFrom | undefined,
  row: RepeaterRow,
): string | undefined {
  if (!rule) return undefined;
  const value = row[rule.field];
  if (isEmptyCell(value)) return rule.empty ?? rule.fallback;
  const key = lookupKey(value);
  if (key !== undefined && Object.hasOwn(rule.map, key)) return rule.map[key];
  return rule.fallback;
}
