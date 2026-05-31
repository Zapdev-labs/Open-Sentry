export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
}

let userContext: UserContext | undefined;
const tags: Record<string, string> = {};

export function setUser(user: UserContext | null): void {
  userContext = user ?? undefined;
}

export function setTag(key: string, value: string): void {
  tags[key] = value;
}

export function setTags(newTags: Record<string, string>): void {
  for (const [key, value] of Object.entries(newTags)) {
    tags[key] = value;
  }
}

export function getScope(): {
  user?: UserContext;
  tags: Record<string, string>;
} {
  return {
    user: userContext,
    tags: { ...tags },
  };
}

export function clearScope(): void {
  userContext = undefined;
  for (const key of Object.keys(tags)) {
    delete tags[key];
  }
}
