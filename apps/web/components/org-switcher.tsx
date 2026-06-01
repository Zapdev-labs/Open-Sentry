"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

interface OrgSwitcherProps {
  activeOrganizationId: string | null;
}

export function OrgSwitcher({ activeOrganizationId }: OrgSwitcherProps) {
  return (
    <div className="org-switcher">
      <OrganizationSwitcher
        hidePersonal
        afterSelectOrganizationUrl="/dashboard"
        afterCreateOrganizationUrl="/dashboard"
        organizationProfileMode="modal"
        createOrganizationMode="modal"
      />
    </div>
  );
}
