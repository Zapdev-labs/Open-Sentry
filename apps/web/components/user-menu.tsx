"use client";

import { UserButton } from "@clerk/nextjs";

export function UserMenu() {
  return (
    <div className="user-menu">
      <UserButton />
    </div>
  );
}
