export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
}

let userContext: UserContext | undefined;
let releaseContext: string | undefined;
const tags: Record<string, string> = {};

export function setUser(user: UserContext | null): void {
  userContext = user ?? undefined;
}

export function setRelease(release: string | null): void {
  releaseContext = release ?? undefined;
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
  release?: string;
  tags: Record<string, string>;
} {
  return {
    user: userContext,
    release: releaseContext,
    tags: { ...tags },
  };
}

export function clearScope(): void {
  userContext = undefined;
  releaseContext = undefined;
  for (const key of Object.keys(tags)) {
    delete tags[key];
  }
}
