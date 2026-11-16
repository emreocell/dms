import { ImplementInterface } from "@antelopejs/interface-core";
import { expect } from "chai";
import {
  buildSiteLayoutPayload,
  internal as pageImplInternal,
} from "../../../../implementations/dms/page";
import * as permissionsImpl from "../../../../implementations/dms/permissions";
import * as permissionsResolverImpl from "../../../../implementations/dms/permissions-resolver";
import * as tenantAccessImpl from "../../../../implementations/dms/tenant-access";
import {
  PageController,
  internal as pageInterfaceInternal,
  pagesCategory,
} from "@antelopejs/interface-dms/page";
import * as permissionsInterface from "@antelopejs/interface-dms/permissions";
import * as permissionsResolverInterface from "@antelopejs/interface-dms/permissions-resolver";
import * as tenantAccessInterface from "@antelopejs/interface-dms/tenant-access";
import {
  registerTestPage,
  stubPageAccessModels,
} from "../../../helpers/page-access";
import { userFixture } from "../../../helpers/user-fixture";

const PINNED_ID = "mfp-help";
const PINNED_FULL_ID = `${pagesCategory.fullId}.${PINNED_ID}`;
const PLAIN_ID = "mfp-home";
const TENANT = "mfp-tenant";
const MEMBER = userFixture({ _id: "mfp-member" });

async function pagesLevelFor(permissions: string[]) {
  const { memberModel, roleModel } = stubPageAccessModels(permissions);
  const payload = await buildSiteLayoutPayload(
    MEMBER,
    memberModel,
    roleModel,
    TENANT,
  );
  return payload.siteLayoutTree.children[pagesCategory.id]?.children ?? {};
}

describe("[unit] implementations/dms/page — a menu entry pinned to the sidebar footer", () => {
  const cleanups: Array<() => void> = [];

  before(async () => {
    ImplementInterface(permissionsInterface, permissionsImpl);
    ImplementInterface(permissionsResolverInterface, permissionsResolverImpl);
    ImplementInterface(tenantAccessInterface, tenantAccessImpl);
    ImplementInterface(pageInterfaceInternal, pageImplInternal);

    cleanups.push(
      await registerTestPage(
        PageController(PINNED_ID, {
          displayName: "Help",
          category: pagesCategory,
          placement: "footer",
        }),
      ),
      await registerTestPage(
        PageController(PLAIN_ID, {
          displayName: "Home",
          category: pagesCategory,
        }),
      ),
    );
  });

  after(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it("is served with its placement", async () => {
    const pages = await pagesLevelFor([pagesCategory.fullId, PINNED_FULL_ID]);

    expect(pages[PINNED_ID]?.placement).to.equal("footer");
    expect(pages[PINNED_ID]?.hasAccess).to.equal(true);
    expect(pages[PLAIN_ID]?.placement).to.equal(undefined);
  });

  it("is served unreachable to a member without its permission", async () => {
    const pages = await pagesLevelFor([pagesCategory.fullId]);

    expect(pages[PINNED_ID]?.hasAccess).to.equal(false);
  });
});
