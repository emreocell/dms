import type { ComponentInfoSerialized } from "../component";
import type { ArrayItemPlaceholderFrom } from "./data-types/field-types";
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
