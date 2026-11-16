import {
  PageController,
  RegisterPage,
  RootCategory,
} from "@antelopejs/interface-dms/page";
import { Banner } from "@antelopejs/interface-dms/base";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";

/**
 * A root category pinned to the sidebar footer, above "Modules". A root
 * category is a `label` section, so the footer draws its heading and its pages.
 */
export const footerPinnedCategory = RootCategory("administration", {
  displayName: "Administration",
  icon: "i-ph-wrench",
  placement: "footer",
});

export const FOOTER_PINNED_GENERAL_URL = `${footerPinnedCategory.fullSlug}/general`;

@RegisterPage()
export class FooterPinnedGeneralPage extends PageController(
  "general",
  {
    displayName: "General",
    icon: "i-ph-sliders-horizontal",
    category: footerPinnedCategory,
    order: 1,
    description:
      'Demonstrates: MenuOptions.placement: "footer". Its category is drawn in the sidebar footer, above Modules, not in the menu.',
  },
  DefaultLayout({}),
) {
  static notice = Banner({
    tone: "info",
    icon: "i-ph-push-pin",
    title: 'RootCategory("administration", { placement: "footer" })',
    description:
      "The category and its pages sit in the fixed bottom area of the sidebar, ordered by order, above Back and Modules, on every page.",
  });
}

@RegisterPage()
export class FooterPinnedIntegrationsPage extends PageController(
  "integrations",
  {
    displayName: "Integrations",
    icon: "i-ph-plugs-connected",
    category: footerPinnedCategory,
    order: 2,
    description:
      "Demonstrates: a second page of a category pinned to the sidebar footer.",
  },
  DefaultLayout({}),
) {}
