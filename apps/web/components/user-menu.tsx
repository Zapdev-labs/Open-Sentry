"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { SignOut, User } from "@phosphor-icons/react";

interface UserMenuProps {
  name: string;
  email: string;
  image?: string | null;
}

export function UserMenu({ name, email, image }: UserMenuProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="user-menu">
      <div className="user-menu-trigger">
        {image ? (
          <img src={image} alt="" className="user-avatar" />
        ) : (
          <span className="user-avatar user-avatar-fallback">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="user-menu-meta">
          <span className="user-menu-name">{name}</span>
          <span className="user-menu-email">{email}</span>
        </div>
      </div>
      <div className="user-menu-actions">
        <button type="button" className="user-menu-action" disabled>
          <User size={16} weight="bold" />
          Profile
        </button>
        <button type="button" className="user-menu-action" onClick={handleSignOut}>
          <SignOut size={16} weight="bold" />
          Sign out
        </button>
      </div>
    </div>
  );
}
