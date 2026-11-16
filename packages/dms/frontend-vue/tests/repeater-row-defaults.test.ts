/** @vitest-environment jsdom */
/**
 * A row the user adds starts with the values its columns declare, and so do
 * the rows a field below `min` opens with, which the form reads as its
 * starting value, not a change. A cell whose column reads its placeholder
 * from another cell shows the placeholder of that cell's current value.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  ref,
  inject,
  computed,
  watch,
  onBeforeUnmount,
  type App,
} from "vue";
import {
  formBusInjectionKey,
  formFieldInjectionKey,
} from "@nuxt/ui/composables/useFormField";
import type { FormEvent } from "@nuxt/ui";
import { useEventBus } from "@vueuse/core";
import Repeater from "../layers/dms-ui/app/components/form/components/InputRepeater.vue";
import {
  FORM_FIELD_SAVED_KEY,
  type MarkFieldSaved,
} from "../layers/dms-ui/app/composables/form/types/field-saved";
import { repeaterCellPlaceholder } from "../layers/dms-ui/app/build/composables/form/repeaterRows";
import { registerDmsComponent } from "#dms/frontend-module";

const Cell = defineComponent({
  props: {
    modelValue: { type: [String, Number], default: undefined },
    placeholder: { type: String, default: undefined },
  },
  emits: ["update:modelValue"],
  setup:
    (props, { emit, attrs }) =>
    () =>
      h("input", {
        id: attrs.id,
        value: props.modelValue ?? "",
        placeholder: props.placeholder,
        onInput: (event: Event) => {
          if (event.target instanceof HTMLInputElement)
            emit("update:modelValue", event.target.value);
        },
      }),
});
registerDmsComponent("dms-test-cell", Cell);

const COLUMNS = [
  {
    id: "unit",
    component: { componentName: "dms-test-cell" },
    defaultValue: "hour",
  },
  {
    id: "quantity",
    component: { componentName: "dms-test-cell" },
    defaultValue: 1,
  },
  {
    id: "price",
    component: {
      componentName: "dms-test-cell",
      options: { placeholder: "Price" },
    },
    placeholderFrom: {
      field: "unit",
      map: { hour: "80", day: "600" },
    },
  },
];

let app: App | undefined;

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const Button = defineComponent({
  props: { label: { type: String, default: "" } },
  emits: ["click"],
  setup:
    (props, { emit }) =>
    () =>
      h("button", { onClick: () => emit("click") }, props.label),
});

type Rows = InstanceType<typeof Repeater>["$props"]["modelValue"];

async function mount(rows: Rows, options: { min?: number } = {}) {
  for (const [name, value] of Object.entries({
    inject,
    computed,
    ref,
    watch,
    onBeforeUnmount,
  })) {
    vi.stubGlobal(name, value);
  }
  vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
  const events: string[] = [];
  const saved: Array<Parameters<MarkFieldSaved>> = [];
  const model = ref<Rows>(rows);
  const host = document.createElement("div");
  document.body.append(host);
  app = createApp({
    render: () =>
      h(Repeater, {
        id: "lines",
        columns: COLUMNS,
        modelValue: model.value,
        ...options,
        "onUpdate:modelValue": (next: Rows) => (model.value = next),
      }),
  });
  const bus = useEventBus<FormEvent<object>, string>(Symbol("form-bus"));
  bus.on((event) => events.push(event.type));
  app.provide(formBusInjectionKey, bus);
  app.provide(
    formFieldInjectionKey,
    computed(() => ({ name: "lines", ariaId: "lines-field" })),
  );
  app.provide(FORM_FIELD_SAVED_KEY, (id, value) => saved.push([id, value]));
  app.component("UButton", Button);
  app.component("UIcon", Button);
  app.mount(host);
  await nextTick();
  const addButton = () =>
    [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "dms.form.repeater.add",
    )!;
  const cell = (row: number, column: string) =>
    host.querySelector<HTMLInputElement>(`[id="lines.${row}.${column}"]`)!;
  return { host, events, saved, model, addButton, cell };
}

describe("a repeater's new rows", () => {
  it("adds a row holding the columns' values, without validating", async () => {
    const { events, model, addButton } = await mount([]);
    addButton().click();
    await nextTick();
    expect(model.value).toEqual([{ unit: "hour", quantity: 1 }]);
    expect(events).toEqual([]);
  });

  it("gives each added row its own copy of the values", async () => {
    const { model, addButton, cell } = await mount([]);
    addButton().click();
    await nextTick();
    addButton().click();
    await nextTick();
    const quantity = cell(0, "quantity");
    quantity.value = "5";
    quantity.dispatchEvent(new Event("input"));
    await nextTick();
    expect(model.value).toEqual([
      { unit: "hour", quantity: "5" },
      { unit: "hour", quantity: 1 },
    ]);
  });

  it("opens below min with new rows, as the field's starting value", async () => {
    const { events, saved, model } = await mount(undefined, { min: 2 });
    const rows = [
      { unit: "hour", quantity: 1 },
      { unit: "hour", quantity: 1 },
    ];
    expect(model.value).toEqual(rows);
    expect(saved).toEqual([["lines", rows]]);
    expect(events).toEqual([]);
  });

  it("keeps the rows a field opens with when they reach min", async () => {
    const rows = [{ unit: "day", quantity: 3 }];
    const { saved, model } = await mount(rows, { min: 1 });
    expect(model.value).toEqual(rows);
    expect(saved).toEqual([]);
  });

  it("tops up the rows a field opens with to min", async () => {
    const { model } = await mount([{ unit: "day", quantity: 3 }], { min: 2 });
    expect(model.value).toEqual([
      { unit: "day", quantity: 3 },
      { unit: "hour", quantity: 1 },
    ]);
  });
});

describe("a repeater cell's placeholder from its row", () => {
  it("follows the other cell of its row", async () => {
    const { cell } = await mount([
      { unit: "hour" },
      { unit: "day" },
      { unit: "piece" },
      {},
    ]);
    expect(cell(0, "price").placeholder).toBe("80");
    expect(cell(1, "price").placeholder).toBe("600");
    expect(cell(2, "price").placeholder).toBe("Price");
    expect(cell(3, "price").placeholder).toBe("Price");

    const unit = cell(0, "unit");
    unit.value = "day";
    unit.dispatchEvent(new Event("input"));
    await nextTick();
    expect(cell(0, "price").placeholder).toBe("600");
    expect(cell(1, "price").placeholder).toBe("600");
  });
});

describe("repeaterCellPlaceholder", () => {
  const rule = {
    field: "unit",
    map: { hour: "80", "1": "one" },
    fallback: "—",
  };

  it("takes the fallback for another value, none, or a list", () => {
    expect(repeaterCellPlaceholder(rule, { unit: "hour" })).toBe("80");
    expect(repeaterCellPlaceholder(rule, { unit: 1 })).toBe("one");
    expect(repeaterCellPlaceholder(rule, { unit: "week" })).toBe("—");
    expect(repeaterCellPlaceholder(rule, { unit: "" })).toBe("—");
    expect(repeaterCellPlaceholder(rule, { unit: ["hour"] })).toBe("—");
    expect(repeaterCellPlaceholder(rule, { unit: "toString" })).toBe("—");
  });

  it("keeps the cell's own placeholder without a rule", () => {
    expect(repeaterCellPlaceholder(undefined, { unit: "hour" })).toBe(
      undefined,
    );
  });
});
