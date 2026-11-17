import { z } from "zod";
import type { ComponentInfoSerialized } from "../component";
import type { FormFieldSerialized } from "../component-options/form-field";
import type { ArrayItemPlaceholderFrom } from "./data-types/field-types";
import { type FormPropsSerialized, isFieldGroupSerialized } from "./form-types";
import type { DefaultValue } from "./types";

/** A field of the rows a repeater edits: one column. */
export interface RepeaterColumn {
  id: string;
  /** Eyebrow header of the column. */
  label?: string;
  /** Data type id of the field. */
  type?: string;
  component: ComponentInfoSerialized;
  required?: boolean;
  /** The value of this cell in a row the user adds or `min` creates. */
  defaultValue?: DefaultValue;
  /** The cell's placeholder, read from another cell of its row. */
  placeholderFrom?: ArrayItemPlaceholderFrom;
}

/** The options of a repeater (`FormComponents.InputRepeater`). */
export interface RepeaterOptions {
  columns: RepeaterColumn[];
  /** Rows reordered by a drag handle. */
  sortable?: boolean;
  min?: number;
  max?: number;
  /** Label of the "+ Add …" button (i18n key or literal). */
  addLabel?: string;
}

/** The value column of a key-value editor. */
export interface KeyValueColumn {
  type?: string;
  component: ComponentInfoSerialized;
}

/** The options of a key-value editor (`FormComponents.InputKeyValue`). */
export interface KeyValueOptions {
  value: KeyValueColumn;
  /** Each pair has a box turning it on or off. */
  toggleable?: boolean;
  addLabel?: string;
  keyLabel?: string;
  valueLabel?: string;
}

const placeholderFromSchema = z.object({
  field: z.string(),
  map: z.record(z.string()),
  empty: z.string().optional(),
  fallback: z.string().optional(),
});

const servedRepeaterOptions = z
  .object({
    columns: z.array(
      z
        .object({
          id: z.string(),
          placeholderFrom: placeholderFromSchema.optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

/** Returns the rule to serve for a column, from the one it declares. */
export type PlaceholderFromResolver = (
  declared: ArrayItemPlaceholderFrom | undefined,
) => ArrayItemPlaceholderFrom | undefined;

function withColumnRule(
  field: FormFieldSerialized,
  columnId: string,
  resolve: PlaceholderFromResolver,
): FormFieldSerialized {
  const parsed = servedRepeaterOptions.safeParse(field.component.options);
  if (!parsed.success) return field;
  const columns = parsed.data.columns.map((column) => {
    if (column.id !== columnId) return column;
    const { placeholderFrom, ...rest } = column;
    const served = resolve(placeholderFrom);
    return served ? { ...rest, placeholderFrom: served } : rest;
  });
  return {
    ...field,
    component: { ...field.component, options: { ...parsed.data, columns } },
  };
}

/**
 * The served options of a form with the `placeholderFrom` rule of one
 * repeater column replaced by what `resolve` returns from the declared one:
 * what a form's `.onFilter` returns to give the rule per-request texts, such
 * as a tenant's rates. `undefined` removes the rule. The field is looked up
 * by id, in a group too; the other fields and columns are left as they are.
 * The DMS checks the result again when it serves the form: a rule on an
 * input whose placeholder is not a text is dropped.
 */
export function withRepeaterPlaceholderFrom(
  options: FormPropsSerialized,
  fieldId: string,
  columnId: string,
  resolve: PlaceholderFromResolver,
): FormPropsSerialized {
  const visit = (field: FormFieldSerialized) =>
    field.id === fieldId ? withColumnRule(field, columnId, resolve) : field;
  return {
    ...options,
    fields: options.fields.map((entry) =>
      isFieldGroupSerialized(entry)
        ? { ...entry, fields: entry.fields.map(visit) }
        : visit(entry),
    ),
  };
}
