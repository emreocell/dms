/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  computed,
  createApp,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  type App,
} from "vue";
import type { NavigationMenuItem } from "@nuxt/ui";
import { stubModuleReads } from "./helpers/installed-modules-runtime";
import {
  applyMenuRouteState,
  translateMenuItems,
} from "../layers/dms-core/app/utils/menu";
import Sidebar from "../layers/dms-layout/app/entries/components/layout/DashboardSidebar";

type SiteLayoutNode = SiteLayoutTree;

const route = reactive({ path: "/modules/automation/runs", query: {} });
const siteLayoutTree = ref<SiteLayoutNode>();
let app: App;
let host: HTMLDivElement;

const flatten = (
  items: ReadonlyArray<NavigationMenuItem | NavigationMenuItem[]>,
): NavigationMenuItem[] =>
  items.flatMap((item) =>
    Array.isArray(item)
      ? flatten(item)
      : [item, ...flatten(item.children ?? [])],
  );

const Navigation = defineComponent({
  props: {
    items: {
      type: Array<NavigationMenuItem | NavigationMenuItem[]>,
      required: true,
    },
  },
  setup: (props) => () =>
    h(
      "nav",
      flatten(props.items).map((item) =>
        h(
          item.type === "label" ? "span" : "a",
          {
            href: item.to,
            "data-exact": String(item.exact),
            "data-active": String(item.active),
          },
          item.label,
        ),
      ),
    ),
});

function installRuntime() {
  Object.entries({
    computed,
    ref,
    watch,
    onMounted,
    onBeforeUnmount,
  }).forEach(([key, value]) => vi.stubGlobal(key, value));
  vi.stubGlobal("useI18n", () => ({
    t: (key: string) => key,
    locale: ref("en"),
  }));
  stubModuleReads();
  vi.stubGlobal("useDmsAppConfig", () => ({}));
  vi.stubGlobal("useTranslation", () => ({
    processI18n: (value: string) => value,
  }));
  vi.stubGlobal("useDmsRoute", () => route);
  vi.stubGlobal("useDmsState", <T>(_key: string, initial: () => T) =>
    ref(initial()),
  );
  vi.stubGlobal("isDmsHydrating", () => false);
  vi.stubGlobal(
    "useDmsCookie",
    <T>(_key: string, options: { default: () => T }) => ref(options.default()),
  );
  vi.stubGlobal("useSiteLayout", () => ({
    siteLayout: ref({}),
    siteLayoutTree,
    findMatchingRoute: () => null,
    findMatchingRouteOrCategory: (path: string) => {
      const fullId = path.split("/").filter(Boolean).join(".");
      return fullId ? { metadata: { fullId } } : null;
    },
  }));
  vi.stubGlobal("useFavoritePages", () => ({
    cleanupInvalidFavorites: vi.fn(),
    sortedFavorites: ref([]),
  }));
  vi.stubGlobal("useIsOwner", () => ref(true));
  vi.stubGlobal("useCurrentModule", () =>
    computed(() =>
      route.path.startsWith("/modules/automation")
        ? {
            id: "automation",
            info: { icon: "i-ph-robot", title: "Automation" },
          }
        : null,
    ),
  );
  vi.stubGlobal("useSidebarWidgets", () => ({ widgets: ref([]) }));
  vi.stubGlobal("useHomepage", () => "/settings");
  vi.stubGlobal("useCurrentUser", () => ({ user: ref({ name: "Viewer" }) }));
  vi.stubGlobal("useLogout", () => ({ logout: vi.fn() }));
  vi.stubGlobal("useColorModePreference", () => ref("light"));
  vi.stubGlobal("useUniqueLocales", () => ({ uniqueLocales: ref([]) }));
  vi.stubGlobal("useUserLanguage", () => ({ changeLanguage: vi.fn() }));
  vi.stubGlobal("useFileReadUrls", () => ({
    getUrl: () => undefined,
    resolve: async () => {},
  }));
  vi.stubGlobal("SETTINGS_ROUTE", "/settings");
  vi.stubGlobal("ACCOUNT_MENU_ENTRIES", []);
  vi.stubGlobal("collectOpenItemIds", () => []);
  vi.stubGlobal("translateMenuItems", translateMenuItems);
  vi.stubGlobal("applyMenuRouteState", applyMenuRouteState);
  vi.stubGlobal("DEFAULT_PAGE_ICON", "i-ph-file");
}

beforeEach(() => {
  siteLayoutTree.value = undefined;
  installRuntime();
  host = document.createElement("div");
});
afterEach(() => {
  app?.unmount();
  vi.unstubAllGlobals();
});

function mountSidebar(): void {
  app = createApp(Sidebar);
  app.component(
    "UDashboardSidebar",
    defineComponent({
      setup:
        (_, { slots }) =>
        () => [
          h(
            "div",
            { "data-part": "menu" },
            slots.default?.({ collapsed: false }),
          ),
          h(
            "div",
            { "data-part": "footer" },
            slots.footer?.({ collapsed: false }),
          ),
        ],
    }),
  );
  app.component("DmsNavigationMenu", Navigation);
  app.component("DmsDashboardSearch", defineComponent({ render: () => null }));
  app.mount(host);
}

interface NodeFixture {
  id: string;
  fullId?: string;
  type?: "label" | "link";
  order?: number;
  placement?: "menu" | "footer";
  hasAccess?: boolean;
  page?: boolean;
  children?: NodeFixture[];
}

function node(
  { children = [], page = true, ...fixture }: NodeFixture,
  parent = "",
): SiteLayoutNode {
  const fullId =
    fixture.fullId ?? (parent ? `${parent}.${fixture.id}` : fixture.id);
  return {
    displayName: fixture.id,
    fullSlug: `/${fullId.replaceAll(".", "/")}`,
    hasAccess: true,
    layoutUrl:
      page && fixture.type !== "label" ? `/${fullId}/pagelayout` : undefined,
    ...fixture,
    fullId,
    children: Object.fromEntries(
      children.map((child) => [child.id, node(child, fullId)]),
    ),
    childrenOrders: children.map((child) => child.id),
  };
}

const root = (children: NodeFixture[]) =>
  node({ id: "", fullId: "", page: false, children });

const linkLabels = (part: "menu" | "footer") =>
  [
    ...host.querySelectorAll(
      `[data-part="${part}"] nav a, [data-part="${part}"] nav span`,
    ),
  ].map((link) => link.textContent);

it("draws a pinned entry in the footer above Modules and leaves it out of the menu", () => {
  route.path = "/reports";
  siteLayoutTree.value = root([
    { id: "reports" },
    { id: "admin", placement: "footer" },
  ]);
  mountSidebar();

  expect(linkLabels("menu")).toEqual(["reports"]);
  expect(linkLabels("footer")).toEqual(["admin", "menu.modules"]);
});

it("sorts pinned entries by order, a sectioned page among them, before Back and Modules", () => {
  route.path = "/modules/automation/runs";
  siteLayoutTree.value = root([
    {
      id: "pages",
      type: "label",
      children: [{ id: "help", placement: "footer", order: 2 }, { id: "home" }],
    },
    { id: "admin", placement: "footer", order: 3 },
    { id: "billing", placement: "footer", order: 1 },
  ]);
  mountSidebar();

  expect(linkLabels("footer")).toEqual([
    "billing",
    "help",
    "admin",
    "menu.back",
    "menu.modules",
  ]);
});

it("draws a pinned label category as its heading and its pages", () => {
  route.path = "/reports";
  siteLayoutTree.value = root([
    { id: "reports" },
    {
      id: "admin",
      type: "label",
      placement: "footer",
      children: [{ id: "general" }, { id: "integrations" }],
    },
  ]);
  mountSidebar();

  expect(linkLabels("menu")).toEqual(["reports"]);
  expect(linkLabels("footer")).toEqual([
    "admin",
    "general",
    "integrations",
    "menu.modules",
  ]);
});

it("draws no pinned entry the user may not open", () => {
  route.path = "/reports";
  siteLayoutTree.value = root([
    { id: "reports" },
    { id: "admin", placement: "footer", hasAccess: false },
    {
      id: "pages",
      type: "label",
      children: [{ id: "help", placement: "footer", hasAccess: false }],
    },
  ]);
  mountSidebar();

  expect(linkLabels("footer")).toEqual(["menu.modules"]);
  expect(linkLabels("menu")).toEqual(["reports"]);
});

it("marks the pinned entry of the current page active", () => {
  route.path = "/admin";
  siteLayoutTree.value = root([{ id: "admin", placement: "footer" }]);
  mountSidebar();

  expect(
    host
      .querySelector('[data-part="footer"] a[href="/admin"]')
      ?.getAttribute("data-active"),
  ).toBe("true");
});

it.each(["/modules/automation/runs", "/modules", "/settings/user/profile"])(
  "keeps exact footer destinations and no Settings entry on %s",
  (path) => {
    route.path = path;
    mountSidebar();
    const modules = [...host.querySelectorAll('a[href="/modules"]')];
    expect(modules).toHaveLength(
      path.startsWith("/modules/automation") ? 2 : 1,
    );
    modules.forEach((link) =>
      expect(link.getAttribute("data-exact")).toBe("true"),
    );

    expect(host.querySelector('a[href^="/settings"]')).toBeNull();
    expect(host.querySelector('nav [data-active="true"]')).toBeNull();
  },
);
