<script setup lang="ts">
import type { ComponentInfo } from "#dms-core/app/types/page";
import { EYEBROW_CLASS } from "../../../build/utils/eyebrow";
import {
  formBusInjectionKey,
  formErrorsInjectionKey,
  formInputsInjectionKey,
  useFormField,
} from "@nuxt/ui/composables/useFormField";
import { resolveDmsComponent } from "../../../composables/resolveDmsComponent";
import DmsRepeaterTable from "./RepeaterTable.vue";
import type { FormFieldValue } from "../../../composables/form/types/value";
import { FORM_FIELD_SAVED_KEY } from "../../../composables/form/types/field-saved";
import {
  newRepeaterRow,
  repeaterCellPlaceholder,
  type RepeaterPlaceholderFrom,
  type RepeaterRow,
} from "../../../build/composables/form/repeaterRows";
import {
  repeaterRowErrorName,
  repeaterRowsPattern,
} from "../../../build/composables/form/repeaterRowErrors";

/** A field of the rows: one column. */
interface RepeaterColumn {
  id: string;
  label?: string;
  type?: string;
  component: ComponentInfo;
  required?: boolean;
  /** The cell's value in a row added or created to reach `min`. */
  defaultValue?: FormFieldValue;
  /** The cell's placeholder, read from another cell of its row. */
  placeholderFrom?: RepeaterPlaceholderFrom;
}

interface RepeaterProps {
  id?: string;
  columns: RepeaterColumn[];
  sortable?: boolean;
  min?: number;
  max?: number;
  /** Label of the "+ Add …" button; a generic one by default. */
  addLabel?: string;
  /** Grey help line under the rows. */
  hint?: string;
  disabled?: boolean;
}

const props = defineProps<RepeaterProps>();
const model = defineModel<RepeaterRow[] | null | undefined>();
const { t } = useI18n();

const { name: fieldName } = useFormField();
const formBus = inject(formBusInjectionKey, null);
const formErrors = inject(formErrorsInjectionKey, null);
const formInputs = inject(formInputsInjectionKey, null);
const markFieldSaved = inject(FORM_FIELD_SAVED_KEY, null);

const rows = computed<RepeaterRow[]>(() =>
  Array.isArray(model.value) ? model.value : [],
);

let nextKey = 0;
const rowKeys = ref<number[]>([]);
watch(
  () => rows.value.length,
  (length) => {
    while (rowKeys.value.length < length) rowKeys.value.push(nextKey++);
    rowKeys.value.length = length;
  },
  { immediate: true },
);

const canAdd = computed(
  () =>
    !props.disabled &&
    (props.max === undefined || rows.value.length < props.max),
);
const canRemove = computed(
  () => !props.disabled && rows.value.length > (props.min ?? 0),
);

const FLUID_COLUMN = "minmax(0,1fr)";
type ColumnWidths = Record<NonNullable<RepeaterColumn["type"]>, string>;
const COLUMN_WIDTHS: ColumnWidths = { boolean: "20px" };
const HANDLE_COLUMN = "20px";
const REMOVE_COLUMN = "28px";

/** The columns of a row: the handle, the given cell columns, the remove button. */
function rowTemplate(cellColumns: string[]): string {
  return [props.sortable ? HANDLE_COLUMN : "", ...cellColumns, REMOVE_COLUMN]
    .filter(Boolean)
    .join(" ");
}

const STACKED_HIDDEN_CLASS = "@max-[30rem]:hidden";
const STACKED_ROW_CLASSES = {
  row: "@max-[30rem]:grid-cols-(--dms-repeater-stacked-columns) @max-[30rem]:items-start @max-[30rem]:rounded-md @max-[30rem]:border @max-[30rem]:border-default @max-[30rem]:p-2.5",

  cells: "contents @max-[30rem]:grid @max-[30rem]:min-w-0 @max-[30rem]:gap-2.5",
  cell: "grid min-w-0 gap-1",
  label: `${EYEBROW_CLASS} text-dimmed hidden truncate @max-[30rem]:block`,
};
const gridTemplate = computed(() => ({
  "--dms-repeater-columns": rowTemplate(
    props.columns.map(
      (column) => COLUMN_WIDTHS[column.type ?? ""] ?? FLUID_COLUMN,
    ),
  ),
  "--dms-repeater-stacked-columns": rowTemplate([FLUID_COLUMN]),
}));

/** The keys of the rows the user edited: only their cells are checked. */
const editedRows = new Set<number>();

/** The name the field's row-scoped validations go under. */
function rowsScopeName(name: string): string {
  return `${name}.$rows`;
}

/**
 * Checks the field's own errors and the cells of the edited rows, never a
 * row nobody touched: a row added, or opened with to reach `min`, waits for
 * an edit or the submit. The scope is a form input of its own whose pattern
 * names those rows, so UForm replaces their errors and keeps the others.
 */
function validateEditedRows(): void {
  const name = fieldName.value;
  if (!name || !formBus || !formInputs) return;
  const edited = rowKeys.value.flatMap((key, index) =>
    editedRows.has(key) ? [index] : [],
  );
  const scope = rowsScopeName(name);
  formInputs.value[scope] = {
    id: scope,
    pattern: repeaterRowsPattern(name, edited),
  };
  formBus.emit({ type: "change", name: scope });
}

/**
 * Moves the errors shown under the rows to the index each row now holds,
 * from the row keys before the change: an error stays with its row when a
 * row above it is removed or moved, and a removed row's errors go with it.
 */
function moveRowErrors(keysBefore: readonly number[]): void {
  const name = fieldName.value;
  if (!name || !formErrors) return;
  const moved = formErrors.value.flatMap((error) => {
    const renamed = repeaterRowErrorName(name, error.name, (index) =>
      rowKeys.value.indexOf(keysBefore[index] ?? -1),
    );
    if (renamed === null) return [];
    if (renamed === error.name) return [error];
    return [{ ...error, name: renamed, id: renamed }];
  });
  formErrors.value.splice(0, formErrors.value.length, ...moved);
}

/** Sets the rows without checking them: a cell edit or a move checks next. */
function emitRows(next: RepeaterRow[]): void {
  model.value = next;
}

function setCell(
  index: number,
  column: string,
  value: RepeaterRow[string],
): void {
  const key = rowKeys.value[index];
  if (key !== undefined) editedRows.add(key);
  emitRows(
    rows.value.map((row, at) =>
      at === index ? { ...row, [column]: value } : row,
    ),
  );
  validateEditedRows();
}

function newRow(): RepeaterRow {
  return newRepeaterRow(props.columns);
}

function addRow(): void {
  rowKeys.value.push(nextKey++);
  emitRows([...rows.value, newRow()]);
}

/**
 * Below `min`, the field gets the missing rows, each a new row, as the value
 * it opens with: the form does not read them as a change to save.
 */
watch(
  () => rows.value.length,
  (length) => {
    const missing = (props.min ?? 0) - length;
    if (props.disabled || missing <= 0) return;
    const next = [
      ...rows.value,
      ...Array.from({ length: missing }, () => newRow()),
    ];
    emitRows(next);
    if (props.id) markFieldSaved?.(props.id, next);
  },
  { immediate: true },
);

function removeRow(index: number): void {
  const keysBefore = [...rowKeys.value];
  const [key] = rowKeys.value.splice(index, 1);
  if (key !== undefined) editedRows.delete(key);
  emitRows(rows.value.filter((_, at) => at !== index));
  moveRowErrors(keysBefore);
  validateEditedRows();
}

function moveRow(from: number, to: number): void {
  if (to < 0 || to >= rows.value.length || from === to) return;
  const next = [...rows.value];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row!);
  const keysBefore = [...rowKeys.value];
  const [key] = rowKeys.value.splice(from, 1);
  rowKeys.value.splice(to, 0, key!);
  emitRows(next);
  moveRowErrors(keysBefore);
  validateEditedRows();
}

type MoveKeys = Record<KeyboardEvent["key"], number>;
const MOVE_KEYS: MoveKeys = { ArrowUp: -1, ArrowDown: 1 };

function onHandleKeydown(event: KeyboardEvent, index: number): void {
  const step = MOVE_KEYS[event.key];
  if (step === undefined) return;
  event.preventDefault();
  moveRow(index, index + step);
}

const draggedIndex = ref<number | null>(null);

function onDrop(index: number): void {
  if (draggedIndex.value !== null) moveRow(draggedIndex.value, index);
  draggedIndex.value = null;
}

/** The name a cell's errors go under, and the id of its control. */
function cellName(index: number, column: string): string {
  return `${fieldName.value ?? props.id ?? "rows"}.${index}.${column}`;
}

function isCellInvalid(index: number, column: string): boolean {
  const name = cellName(index, column);
  return !!formErrors?.value.some((error) => error.name === name);
}

function cellNames(length: number): string[] {
  return Array.from({ length }, (_, index) =>
    props.columns.map((column) => cellName(index, column.id)),
  ).flat();
}

function unregisterCells(names: readonly string[]): void {
  for (const name of names) delete formInputs?.value[name];
}

let registered: string[] = [];
watch(
  () => [fieldName.value, rows.value.length] as const,
  ([name, length]) => {
    unregisterCells(registered);
    registered = name && formInputs ? cellNames(length) : [];
    for (const cell of registered) formInputs!.value[cell] = { id: cell };
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  unregisterCells(registered);
  if (fieldName.value) unregisterCells([rowsScopeName(fieldName.value)]);
});

/** A cell's options, with the placeholder its row picks. */
function cellOptions(column: RepeaterColumn, row: RepeaterRow) {
  const options = column.component.options || {};
  const placeholder = repeaterCellPlaceholder(column.placeholderFrom, row);
  return placeholder === undefined ? options : { ...options, placeholder };
}

function cellComponent(column: RepeaterColumn) {
  const name = column.component.componentName;
  return name ? resolveDmsComponent(name) || name : null;
}

const hasHeaders = computed(() => props.columns.some((column) => column.label));
</script>

<template>
  <!-- Read-only, the rows are values to read, not controls: a table. -->
  <DmsRepeaterTable
    v-if="props.disabled"
    :id="props.id"
    :columns="props.columns"
    :rows="rows"
  />
  <div v-else :id="props.id" class="@container grid gap-1.5" role="group">
    <div
      v-if="hasHeaders && rows.length"
      :class="[
        EYEBROW_CLASS,
        'text-dimmed grid grid-cols-(--dms-repeater-columns) items-end gap-2',
        STACKED_HIDDEN_CLASS,
      ]"
      :style="gridTemplate"
      aria-hidden="true"
    >
      <span v-if="props.sortable" />
      <span v-for="column in props.columns" :key="column.id" class="truncate">
        {{ column.label }}
      </span>
      <span />
    </div>

    <div
      v-for="(row, index) in rows"
      :key="rowKeys[index]"
      :class="[
        'grid grid-cols-(--dms-repeater-columns) items-center gap-2',
        STACKED_ROW_CLASSES.row,
        draggedIndex === index && 'opacity-50',
      ]"
      :style="gridTemplate"
      @dragover.prevent
      @drop.prevent="onDrop(index)"
    >
      <button
        v-if="props.sortable"
        type="button"
        class="text-dimmed hover:text-default grid h-8 cursor-grab place-items-center rounded-md"
        :draggable="!props.disabled"
        :disabled="props.disabled"
        :aria-label="t('dms.form.repeater.move', { row: index + 1 })"
        @dragstart="draggedIndex = index"
        @dragend="draggedIndex = null"
        @keydown="onHandleKeydown($event, index)"
      >
        <UIcon name="i-ph-dots-six-vertical" class="size-4" />
      </button>
      <div :class="STACKED_ROW_CLASSES.cells">
        <div
          v-for="column in props.columns"
          :key="column.id"
          :class="STACKED_ROW_CLASSES.cell"
        >
          <span
            v-if="column.label"
            :class="STACKED_ROW_CLASSES.label"
            aria-hidden="true"
          >
            {{ column.label }}
          </span>
          <Component
            :is="cellComponent(column)"
            :id="cellName(index, column.id)"
            :model-value="row[column.id]"
            size="sm"
            class="w-full min-w-0"
            :disabled="props.disabled"
            :aria-label="column.label"
            :aria-invalid="isCellInvalid(index, column.id) || undefined"
            :color="isCellInvalid(index, column.id) ? 'error' : undefined"
            :highlight="isCellInvalid(index, column.id) || undefined"
            v-bind="cellOptions(column, row)"
            @update:model-value="setCell(index, column.id, $event)"
          />
        </div>
      </div>
      <UButton
        icon="i-ph-x"
        color="neutral"
        variant="ghost"
        size="sm"
        class="text-dimmed"
        :disabled="!canRemove"
        :aria-label="t('dms.form.repeater.remove', { row: index + 1 })"
        @click="removeRow(index)"
      />
    </div>

    <p v-if="props.hint" class="text-dimmed text-xs">{{ props.hint }}</p>

    <div>
      <UButton
        v-if="canAdd"
        icon="i-ph-plus"
        :label="props.addLabel || t('dms.form.repeater.add')"
        color="primary"
        variant="link"
        size="sm"
        class="px-0"
        @click="addRow"
      />
    </div>
  </div>
</template>
