import { ImplementInterface } from "@antelopejs/interface-core";
import { expect } from "chai";
import { z } from "zod";
import * as permissionsImpl from "../../../../implementations/dms/permissions";
import * as permissionsInterface from "@antelopejs/interface-dms/permissions";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import { Form } from "@antelopejs/interface-dms/base/form";
import type { FormBuilder } from "@antelopejs/interface-dms/base/form-types";
import {
  withRepeaterPlaceholderFrom,
  type PlaceholderFromResolver,
} from "@antelopejs/interface-dms/base/repeater-options";
import {
  type ComponentNodeMap,
  filterComponents,
} from "@antelopejs/interface-dms/page/layout-filter";

const PAGE = "rppr.page";
const FORM = `${PAGE}.form`;

const UNITS = [
  { label: "Hour", value: "hour" },
  { label: "Day", value: "day" },
];

const RATES = new Map<string, Record<string, string>>([
  ["north", { hour: "95", day: "700" }],
  ["south", { hour: "60" }],
]);

const lines = () =>
  new DefaultDataTypes.ArrayType({
    of: {
      unit: { type: new DefaultDataTypes.SelectType({ items: UNITS }) },
      price: {
        type: new DefaultDataTypes.NumberType(),
        placeholderFrom: { field: "unit", map: { hour: "80" }, empty: "80" },
      },
      on: { type: new DefaultDataTypes.DateType() },
    },
  });

const servedColumn = z.object({
  id: z.string(),
  placeholderFrom: z
    .object({ map: z.record(z.string()), empty: z.string().optional() })
    .optional(),
});

type ServedColumn = z.infer<typeof servedColumn>;

const linesField = z.object({
  id: z.literal("lines"),
  component: z.object({
    options: z.object({ columns: z.array(servedColumn) }),
  }),
});

const servedEntries = z.object({
  fields: z.array(
    z.object({ fields: z.array(z.unknown()).optional() }).passthrough(),
  ),
});

/** The columns of the `lines` repeater a tenant is served, by column id. */
async function servedColumns(
  form: FormBuilder,
  tenantId: string,
): Promise<Record<string, ServedColumn>> {
  const map: ComponentNodeMap = new Map([
    [FORM, { component: form, permissionId: FORM, depth: 0, access: "own" }],
  ]);
  const served = await filterComponents(
    { form: await form.serialize() },
    PAGE,
    new Set(["*"]),
    map,
    { tenantId, user: undefined },
  );
  const entries = servedEntries
    .parse(served.form?.options)
    .fields.flatMap((entry) => entry.fields ?? [entry]);
  const field = entries
    .map((entry) => linesField.safeParse(entry))
    .find((parsed) => parsed.success);
  if (!field?.success) throw new Error("No repeater columns served");
  const columns = field.data.component.options.columns;
  return Object.fromEntries(columns.map((column) => [column.id, column]));
}

const withTenantRates =
  (tenantId: string): PlaceholderFromResolver =>
  (declared) =>
    declared && { ...declared, map: RATES.get(tenantId) ?? declared.map };

describe("[unit] interfaces/dms-base — a repeater placeholder rule per request", () => {
  before(() => ImplementInterface(permissionsInterface, permissionsImpl));

  it("serves each tenant the map its form's onFilter resolves", async () => {
    const form = Form({ fields: [{ id: "lines", type: lines() }] }).onFilter(
      (_permissions, options, _id, context) =>
        withRepeaterPlaceholderFrom(
          options,
          "lines",
          "price",
          withTenantRates(context.tenantId),
        ),
    );
    const north = await servedColumns(form, "north");
    const south = await servedColumns(form, "south");
    expect(north.price?.placeholderFrom?.map).to.deep.equal(RATES.get("north"));
    expect(north.price?.placeholderFrom?.empty).to.equal("80");
    expect(south.price?.placeholderFrom?.map).to.deep.equal(RATES.get("south"));
  });

  it("finds the field in a group and removes the rule when resolved to none", async () => {
    const form = Form({
      fields: [{ id: "group", fields: [{ id: "lines", type: lines() }] }],
    }).onFilter((_permissions, options) =>
      withRepeaterPlaceholderFrom(options, "lines", "price", () => undefined),
    );
    const columns = await servedColumns(form, "north");
    expect(columns.price).to.not.have.property("placeholderFrom");
  });

  it("drops a rule an onFilter writes onto an input whose placeholder is a date", async () => {
    const form = Form({ fields: [{ id: "lines", type: lines() }] }).onFilter(
      (_permissions, options) =>
        withRepeaterPlaceholderFrom(options, "lines", "on", () => ({
          field: "unit",
          map: { hour: "2026-01-01" },
        })),
    );
    const columns = await servedColumns(form, "north");
    expect(columns.on).to.not.have.property("placeholderFrom");
    expect(columns.price?.placeholderFrom?.map).to.deep.equal({ hour: "80" });
  });
});
