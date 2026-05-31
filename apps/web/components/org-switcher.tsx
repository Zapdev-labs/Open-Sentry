"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { organization } from "@/lib/auth-client";
import { CaretDown } from "@phosphor-icons/react";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrgSwitcherProps {
  organizations: Organization[];
  activeOrganizationId: string | null;
}

export function OrgSwitcher({ organizations, activeOrganizationId }: OrgSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const activeOrg =
    organizations.find((org) => org.id === activeOrganizationId) ?? organizations[0];

  useEffect(() => {
    if (!activeOrganizationId && organizations[0]) {
      void organization.setActive({ organizationId: organizations[0].id }).then(() => {
        router.refresh();
      });
    }
  }, [activeOrganizationId, organizations, router]);

  async function handleSelect(organizationId: string) {
    if (organizationId === activeOrg?.id) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    await organization.setActive({ organizationId });
    setSwitching(false);
    setOpen(false);
    router.refresh();
  }

  if (!activeOrg) return null;

  return (
    <div className="org-switcher">
      <button
        type="button"
        className="org-switcher-trigger"
        onClick={() => setOpen((value) => !value)}
        disabled={switching}
      >
        <span>{activeOrg.name}</span>
        <CaretDown size={14} weight="bold" />
      </button>
      {open && (
        <div className="org-switcher-menu">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              className={`org-switcher-item ${org.id === activeOrg.id ? "active" : ""}`}
              onClick={() => handleSelect(org.id)}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
