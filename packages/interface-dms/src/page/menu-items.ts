/** The vocabulary of a menu entry: its kind, look, placement and link. */
export type MenuItemType = "label" | "link";

/**
 * Semantic look of a menu entry. `accent` renders the entry in the theme's
 * primary color, for call-to-action entries such as "New project".
 */
export type MenuItemVariant = "default" | "accent";

/**
 * Semantic state dot rendered at the end of a menu entry. Maps to the theme's
 * semantic colors, so a consumer never ships raw classes.
 */
export type MenuItemStatus = "success" | "warning" | "error" | "neutral";

/**
 * Where the sidebar draws a first-level menu entry. `menu`, the default, lists
 * it in the scrolling menu. `footer` pins it in the sidebar's fixed bottom
 * area, above the built-in "Back" and "Modules" entries and the user menu.
 */
export type MenuPlacement = "menu" | "footer";

/** Query parameters appended to a menu entry's link. */
export type MenuItemQuery = Record<string, string>;

/** Values for the `:name` segments of the page slug a menu entry links to. */
export type MenuItemParams = Record<string, string>;
