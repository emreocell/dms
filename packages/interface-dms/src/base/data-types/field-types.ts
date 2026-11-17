import { z } from "zod";
import { adaptFieldValidationSchema, FormComponents } from "../form-schema";
import { DefaultDataCompareTypes } from "./compare-types";
import type { DefaultValue } from "../types";
import { TEXT_PLACEHOLDER_INPUTS } from "../internal/repeater-placeholder";
import { DataType, getDataTypeId, RegisterDataType } from "./core";

/**
 * The placeholder of a field of an `ArrayType` row chosen by the value of
 * another field of the same row: `map` gives the placeholder per value of
 * the field `field` names (its value as text), `empty` the one while that
 * field holds no value, `fallback` the one for a value `map` lacks. Without
 * `empty`, an empty field takes `fallback` too; without a match nor
 * `fallback`, the field keeps the placeholder of its type. Texts are i18n
 * keys (`$…`) or literals.
 */
export interface ArrayItemPlaceholderFrom {
  /** Key of the other field of the row. */
  field: string;
  map: Record<string, string>;
  /** While the other field holds no value (none, `""`, `[]`). */
  empty?: string;
  /** For a value of the other field that `map` has no entry for. */
  fallback?: string;
}

/** A field of the rows an `ArrayType` holds, with a column header. */
export interface ArrayItemField {
  type: DataType;
  /** Header of its column (i18n key or literal); the key by default. */
  label?: string;
  /** A row is refused without it. */
  required?: boolean;
  /**
   * The value of this field in a row the user adds, and in the rows the
   * form opens with to reach `min`. A row is checked once edited or on
   * submit, not the moment it appears.
   */
  defaultValue?: DefaultValue;
  /**
   * The placeholder of this field read from another field of the same row:
   * `{ field: "unit", map: { hour: "80", day: "600" }, empty?, fallback? }`.
   * The value of `field`, as text, picks the entry of `map`; no value takes
   * `empty` (else `fallback`), a value `map` lacks takes `fallback`, and
   * without them the field keeps the placeholder of its type. Applies to
   * the inputs showing a text placeholder (a text, textarea, email, phone,
   * number, percentage, tags, select or relation input); any other input
   * ignores it, also when an `onFilter` writes the rule per request.
   */
  placeholderFrom?: ArrayItemPlaceholderFrom;
}

/** A field of an `ArrayType`'s rows: its type alone, or with a header. */
export type ArrayItemFieldInput = DataType | ArrayItemField;

/** The options `ArrayType` takes. */
export type ArrayTypeOptions = {
  /** The fields of a row, by key: each row is an object of them. */
  of: Record<string, ArrayItemFieldInput>;
  /** Rows reordered by a drag handle. */
  sortable?: boolean;
  min?: number;
  max?: number;
  /** Label of the "+ Add …" button (i18n key or literal). */
  addLabel?: string;
  fallback?: string;
};

/** The options `KeyValueType` takes. */
export type KeyValueTypeOptions = {
  /** Type of the values; a text by default. */
  valueType?: DataType;
  /**
   * Each pair has a box turning it on or off: the value of a key becomes
   * `{ value, enabled }`.
   */
  toggleable?: boolean;
  addLabel?: string;
  /** Header of the key column (i18n key or literal). */
  keyLabel?: string;
  /** Header of the value column (i18n key or literal). */
  valueLabel?: string;
  fallback?: string;
};

/** The options `SecretType` takes. */
export type SecretTypeOptions = {
  /** "Show" reveals the value, in the browser only. Default `true`. */
  revealable?: boolean;
  /** A button copies the value. Default `true`. */
  copyable?: boolean;
  /**
   * POSTed after a confirmation, answering `{ value }`: "Rotate…" replaces
   * the secret with a new one, which the route stores itself, so the form
   * does not read it as a change to save. Takes the page URL tokens
   * (`{{params.X}}`, `{{query.X}}`), so an edit form names its record;
   * nothing is offered while one has no value.
   */
  rotateUrl?: string;
  placeholder?: string;
  fallback?: string;
};

/** Languages a `CodeType` highlights. */
export const CODE_LANGUAGES = [
  "json",
  "sql",
  "html",
  "javascript",
  "text",
] as const;

/** A language a `CodeType` highlights: see `CODE_LANGUAGES`. */
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

/** The options `CodeType` takes. */
export type CodeTypeOptions = {
  language: CodeLanguage;
  /** A gutter numbering the lines. Default `true`. */
  lineNumbers?: boolean;
  /** Height of the editor, in lines, before it grows with its text. */
  minLines?: number;
  /** Lines shown before the editor scrolls. */
  maxLines?: number;
  /**
   * GET, answering `{ items }` (or a list) of `{ label, detail?, icon? }`:
   * suggestions merged with `completions` and the language's keywords.
   * Takes the page URL tokens (`{{params.X}}`, `{{query.X}}`); nothing is
   * requested while one has no value.
   */
  completionsUrl?: string;
  completions?: FormComponents.CodeCompletion[];
  placeholder?: string;
  fallback?: string;
};

/** What the tags of a `TagsType` are. */
export const TAG_ITEM_TYPES = ["string", "email"] as const;

/** What the tags of a `TagsType` are: see `TAG_ITEM_TYPES`. */
export type TagItemType = (typeof TAG_ITEM_TYPES)[number];

/** The options `TagsType` takes. */
export type TagsTypeOptions = {
  /** `string` (default) or `email`: an address that is not one is refused. */
  itemType?: TagItemType;
  max?: number;
  /** Offered as the user types. */
  suggestions?: string[];
  placeholder?: string;
  fallback?: string;
};

const PRESENCE_COMPARE_MODES = [
  DefaultDataCompareTypes.IsEmpty,
  DefaultDataCompareTypes.IsNotEmpty,
];

const INVALID_JSON_MESSAGE = "$dms.field_errors.invalid_json";

function itemField(input: ArrayItemFieldInput): ArrayItemField {
  return input instanceof DataType ? { type: input } : input;
}

/**
 * A list of rows, each an object of the fields `of` declares, edited as a
 * repeater: a row per item, a column per field, rows added, removed and,
 * when `sortable`, reordered. The value is the list of objects.
 *
 * @docsApi
 */
@RegisterDataType("array")
export class ArrayType extends DataType {
  constructor(public readonly options: ArrayTypeOptions) {
    super(PRESENCE_COMPARE_MODES, undefined, { ...options });
    for (const [id, field] of this.fields()) {
      const source = field.placeholderFrom?.field;
      if (
        source !== undefined &&
        (source === id || !Object.hasOwn(options.of, source))
      )
        throw new Error(
          `ArrayType: placeholderFrom of "${id}" names "${source}", not another field of the row`,
        );
    }
  }

  private fields(): Array<[string, ArrayItemField]> {
    return Object.entries(this.options.of).map(([id, input]) => [
      id,
      itemField(input),
    ]);
  }

  protected defaultInputComponent() {
    return FormComponents.InputRepeater({
      columns: this.fields().map(([id, field]) => {
        const component = field.type.inputComponent();
        return {
          id,
          label: field.label ?? id,
          type: getDataTypeId(field.type),
          component,
          required: field.required,
          defaultValue: field.defaultValue,
          placeholderFrom: TEXT_PLACEHOLDER_INPUTS.has(component.componentName)
            ? field.placeholderFrom
            : undefined,
        };
      }),
      sortable: this.options.sortable,
      min: this.options.min,
      max: this.options.max,
      addLabel: this.options.addLabel,
    });
  }

  getValidation() {
    const properties = Object.fromEntries(
      this.fields().map(([id, field]) => [
        id,
        adaptFieldValidationSchema(field.type.getValidation(), {
          required: field.required,
        }),
      ]),
    );
    let schema = z.array(z.object(properties));
    if (this.options.min !== undefined) schema = schema.min(this.options.min);
    if (this.options.max !== undefined) schema = schema.max(this.options.max);
    return schema;
  }
}

/**
 * Pairs of a name and a value (headers, labels, environment variables),
 * edited as a repeater of two columns. The value is an object, a key per
 * pair: its value, or `{ value, enabled }` when `toggleable`.
 *
 * @docsApi
 */
@RegisterDataType("key_value")
export class KeyValueType extends DataType {
  constructor(public readonly options: KeyValueTypeOptions = {}) {
    super(PRESENCE_COMPARE_MODES, undefined, { ...options });
  }

  private valueType(): DataType {
    return this.options.valueType ?? new DefaultTextType();
  }

  protected defaultInputComponent() {
    const valueType = this.valueType();
    return FormComponents.InputKeyValue({
      value: {
        type: getDataTypeId(valueType),
        component: valueType.inputComponent(),
      },
      toggleable: this.options.toggleable,
      addLabel: this.options.addLabel,
      keyLabel: this.options.keyLabel,
      valueLabel: this.options.valueLabel,
    });
  }

  getValidation() {
    const value = this.valueType().getValidation().nullable();
    const entry = this.options.toggleable
      ? z.object({ value, enabled: z.boolean() })
      : value;
    return z.record(z.string().min(1), entry);
  }
}

/**
 * A secret the module hands to the user (an API key, a webhook secret). It
 * travels as is: the input shows it masked but its last characters, "Show"
 * reveals it and the copy button copies it, in the browser; "Rotate…"
 * (with `rotateUrl`) asks the module for a new one.
 *
 * @docsApi
 */
@RegisterDataType("secret")
export class SecretType extends DataType {
  constructor(public readonly options: SecretTypeOptions = {}) {
    super(PRESENCE_COMPARE_MODES, undefined, { ...options });
  }

  protected defaultInputComponent() {
    return FormComponents.InputSecret({
      revealable: this.options.revealable ?? true,
      copyable: this.options.copyable ?? true,
      rotateUrl: this.options.rotateUrl,
      placeholder: this.options.placeholder,
    });
  }

  getValidation() {
    return z.string();
  }
}

function isJson(text: string): boolean {
  if (!text.trim()) return true;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Code in a language (`json`, `sql`, `html`, `javascript` or `text`), stored
 * as text and edited in a code editor: line numbers, highlighting and an
 * autocomplete of the language's keywords and the module's `completions`.
 * JSON is refused when it does not parse.
 *
 * @docsApi
 */
@RegisterDataType("code")
export class CodeType extends DataType {
  constructor(public readonly options: CodeTypeOptions) {
    super(PRESENCE_COMPARE_MODES, undefined, { ...options });
  }

  protected defaultInputComponent() {
    const { fallback: _fallback, ...options } = this.options;
    return FormComponents.InputCode(options);
  }

  getValidation() {
    if (this.options.language !== "json") return z.string();
    return z.string().refine(isJson, { message: INVALID_JSON_MESSAGE });
  }
}

/**
 * A list of short texts typed as tags: a pill per item, duplicates ignored.
 * With `itemType: "email"`, an item that is no address is refused. A filter
 * keeps the rows holding a tag (`array_contains_string`, the text typed
 * matched inside each tag, case aside), or with none or some.
 *
 * @docsApi
 */
@RegisterDataType("tags")
export class TagsType extends DataType {
  constructor(public readonly options: TagsTypeOptions = {}) {
    super(
      [DefaultDataCompareTypes.ArrayContainsString, ...PRESENCE_COMPARE_MODES],
      DefaultDataCompareTypes.ArrayContainsString,
      { ...options },
    );
  }

  protected defaultInputComponent() {
    const { fallback: _fallback, ...options } = this.options;
    return FormComponents.InputTags(options);
  }

  override filterComponents() {
    return {
      default: FormComponents.InputText({
        placeholder: this.options.placeholder,
      }),
    };
  }

  getValidation() {
    const item =
      this.options.itemType === "email"
        ? z.string().email()
        : z.string().min(1);
    const list = z.array(item);
    return this.options.max === undefined ? list : list.max(this.options.max);
  }
}

/** The text a key-value pair holds when no value type is given. */
class DefaultTextType extends DataType {
  constructor() {
    super([]);
  }

  protected defaultInputComponent() {
    return FormComponents.InputText();
  }

  getValidation() {
    return z.string();
  }
}
