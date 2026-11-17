/** @internal */
import { z } from "zod";
import type { ComponentInfoSerialized } from "../../component";
import { isNull, isObject } from "../../utils/internal/type-check";

type ServedOptions = ComponentInfoSerialized["options"];

/**
 * The inputs whose placeholder is a text a repeater cell can pick from its
 * row (`ArrayItemField.placeholderFrom`): a date or time input's is a date.
 *
 * @internal
 */
export const TEXT_PLACEHOLDER_INPUTS: ReadonlySet<string> = new Set([
  "dms-input-text",
  "dms-input-textarea",
  "dms-input-email",
  "dms-input-phone",
  "dms-input-number",
  "dms-input-percentage",
  "dms-input-tags",
  "dms-input-select",
  "dms-input-relation",
]);

const servedRepeater = z
  .object({
    componentName: z.literal("dms-input-repeater"),
    options: z.object({ columns: z.array(z.unknown()) }).passthrough(),
  })
  .passthrough();

const ruledColumn = z
  .object({
    placeholderFrom: z.unknown().refine((rule) => rule !== undefined),
    component: z.object({ componentName: z.string() }).passthrough().optional(),
  })
  .passthrough();

const isPlainObject = (
  value: ServedOptions,
): value is Record<string, ServedOptions> =>
  isObject(value) &&
  !isNull(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

/** A repeater column without a placeholder rule its input cannot show. */
function servedColumn(column: ServedOptions): ServedOptions {
  const ruled = ruledColumn.safeParse(column);
  if (!ruled.success) return column;
  const input = ruled.data.component?.componentName;
  if (input !== undefined && TEXT_PLACEHOLDER_INPUTS.has(input)) return column;
  const { placeholderFrom: _dropped, ...rest } = ruled.data;
  return rest;
}

/**
 * Served options with each repeater column's `placeholderFrom` kept only on
 * an input whose placeholder is a text, the check `ArrayType` applies when
 * declared, applied again to what an `onFilter` returned: a rule written per
 * request onto a date column is dropped, not bound to its date placeholder.
 * Walks the options of embedded components too (a table view's forms). A
 * value with nothing to drop keeps its identity.
 *
 * @internal
 */
export function withServedPlaceholderRules(
  value: ServedOptions,
): ServedOptions {
  if (Array.isArray(value)) {
    const items = value.map(withServedPlaceholderRules);
    return items.every((item, index) => item === value[index]) ? value : items;
  }
  if (!isPlainObject(value)) return value;
  const entries = Object.entries(value).map(
    ([key, item]) => [key, withServedPlaceholderRules(item)] as const,
  );
  const changed = entries.some(([key, item]) => item !== value[key]);
  const next = changed ? Object.fromEntries(entries) : value;
  const repeater = servedRepeater.safeParse(next);
  if (!repeater.success) return next;
  const { columns } = repeater.data.options;
  const served = columns.map(servedColumn);
  if (served.every((column, index) => column === columns[index])) return next;
  return {
    ...repeater.data,
    options: { ...repeater.data.options, columns: served },
  };
}
