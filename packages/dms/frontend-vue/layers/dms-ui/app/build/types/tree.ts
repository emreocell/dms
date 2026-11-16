import type { LinkProps, NavigationMenuItem } from "@nuxt/ui";
import { buildLinkWithQuery } from "#dms-core/app/utils/routePath";

export interface TreeItem extends LinkProps {
  id: string;
  title: string;
  icon?: string;
  children?: TreeItem[];
}

export function convertSiteLayoutTreeToTreeItems(
  siteLayoutTree: SiteLayoutTree | null | undefined,
): NavigationMenuItem[][] {
  if (!siteLayoutTree) {
    return [];
  }

  return convertToTreeItems(siteLayoutTree);
}

const EXCLUDED_TOP_LEVEL_IDS = new Set(["settings", "modules"]);

const isPinnedToFooter = (item: SiteLayoutTree): boolean =>
  item.placement === "footer";

function isExcludedFromRoot(item: SiteLayoutTree): boolean {
  return (
    EXCLUDED_TOP_LEVEL_IDS.has(item.id) ||
    item.isModuleRoot === true ||
    item.hasAccess === false
  );
}

export function buildMenuItemTarget(item: SiteLayoutTree): string | undefined {
  if (!item.layoutUrl) {
    return undefined;
  }
  return buildLinkWithQuery(item.fullSlug, item.query);
}

function buildNavigationItem(
  item: SiteLayoutTree,
  children: NavigationMenuItem[],
): DmsMenuItem {
  const to = buildMenuItemTarget(item);
  return {
    id: item.id,
    fullId: item.fullId,
    label: item.displayName,
    icon: item.icon,
    to,
    variant: item.variant,
    status: item.status,
    badge: item.badge,
    badgeTone: item.badgeTone,
    children: children.length > 0 ? children : undefined,
  };
}

function buildLabelGroup(
  item: SiteLayoutTree,
  children: NavigationMenuItem[],
): NavigationMenuItem[] {
  return [
    {
      id: item.id,
      fullId: item.fullId,
      label: item.displayName,
      icon: item.icon,
      type: "label",
    },
    ...children,
  ];
}

function convertToTreeItems(node: SiteLayoutTree): NavigationMenuItem[][] {
  const groups: NavigationMenuItem[][] = [];

  for (const nodeId of node.childrenOrders) {
    const item = node.children[nodeId]!;
    if (isExcludedFromRoot(item) || isPinnedToFooter(item)) {
      continue;
    }

    if (item.type === "label") {
      const children = convertChildrenToItems(
        item,
        (child) => !isPinnedToFooter(child),
      );
      if (children.length === 0) {
        continue;
      }
      groups.push(buildLabelGroup(item, children));
    } else {
      groups.push([buildNavigationItem(item, convertChildrenToItems(item))]);
    }
  }

  return groups;
}

/**
 * The entries pinned to the sidebar footer (`placement: "footer"`): the root
 * entries and the entries of root `label` sections that declare it, sorted by
 * `order`. Each `label` entry is a group of its own, its heading then its
 * entries; consecutive links share one group.
 */
export function convertSiteLayoutTreeToFooterItems(
  siteLayoutTree: SiteLayoutTree | null | undefined,
): NavigationMenuItem[][] {
  if (!siteLayoutTree) {
    return [];
  }

  const groups: NavigationMenuItem[][] = [];
  for (const item of collectFooterEntries(siteLayoutTree)) {
    const children = convertChildrenToItems(item);
    if (item.type === "label") {
      if (children.length > 0) groups.push(buildLabelGroup(item, children));
    } else {
      appendFooterLinks(groups, [buildNavigationItem(item, children)]);
    }
  }
  return groups;
}

/**
 * Adds `links` to the trailing group of `groups` when it holds links, or as a
 * group of their own after a `label` group.
 */
export function appendFooterLinks(
  groups: NavigationMenuItem[][],
  links: NavigationMenuItem[],
): NavigationMenuItem[][] {
  if (links.length === 0) return groups;
  const last = groups.at(-1);
  if (last && last[0]?.type !== "label") {
    last.push(...links);
  } else {
    groups.push(links);
  }
  return groups;
}

function collectFooterEntries(root: SiteLayoutTree): SiteLayoutTree[] {
  const entries = root.childrenOrders.flatMap((nodeId): SiteLayoutTree[] => {
    const item = root.children[nodeId]!;
    if (isExcludedFromRoot(item)) return [];
    if (isPinnedToFooter(item)) return [item];
    if (item.type !== "label") return [];
    return item.childrenOrders
      .map((childId) => item.children[childId]!)
      .filter(
        (child) =>
          isPinnedToFooter(child) &&
          !child.isModuleRoot &&
          child.hasAccess !== false,
      );
  });
  return entries
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) => (a.item.order ?? 0) - (b.item.order ?? 0) || a.index - b.index,
    )
    .map(({ item }) => item);
}

function convertChildrenToItems(
  node: SiteLayoutTree,
  admits: (item: SiteLayoutTree) => boolean = () => true,
): NavigationMenuItem[] {
  return node.childrenOrders.flatMap((nodeId): NavigationMenuItem[] => {
    const item = node.children[nodeId]!;

    if (item.isModuleRoot || !admits(item)) {
      return [];
    }
    if (item.hasAccess === false) {
      return item.layoutUrl ? convertChildrenToItems(item) : [];
    }

    return [buildNavigationItem(item, convertChildrenToItems(item))];
  });
}

const MODULE_PAGES_GROUP_ID = "module-pages";
const MODULE_PAGES_GROUP_LABEL = "$menu.section.pages";

export function convertSiteLayoutTreeToTreeItemsForModule(
  moduleRoot: SiteLayoutTree | null | undefined,
): NavigationMenuItem[][] {
  if (!moduleRoot) {
    return [];
  }

  const subCategoryGroups: NavigationMenuItem[][] = [];
  const pageItems: NavigationMenuItem[] = [];

  for (const nodeId of moduleRoot.childrenOrders) {
    const item = moduleRoot.children[nodeId]!;

    if (item.hasAccess === false) {
      continue;
    }

    const children = convertChildrenToItems(item);

    if (item.type === "label") {
      if (children.length === 0) {
        continue;
      }

      subCategoryGroups.push(buildLabelGroup(item, children));
    } else {
      pageItems.push(buildNavigationItem(item, children));
    }
  }

  const groups: NavigationMenuItem[][] = [];

  if (pageItems.length > 0) {
    groups.push([
      {
        id: MODULE_PAGES_GROUP_ID,
        label: MODULE_PAGES_GROUP_LABEL,
        type: "label",
      },
      ...pageItems,
    ]);
  }
  groups.push(...subCategoryGroups);

  return groups;
}
