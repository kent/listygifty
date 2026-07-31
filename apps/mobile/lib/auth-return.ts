export type AuthReturnPath =
  | `/join/exchange/${string}`
  | `/e/${string}/${string}`;

const PRIVATE_INVITE_PATH = /^\/join\/exchange\/[A-Za-z0-9_-]+$/;
const SHARED_EXCHANGE_PATH = /^\/e\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9_-]+$/;

export function normalizeAuthReturnPath(
  value: string | string[] | undefined
): AuthReturnPath | null {
  if (typeof value !== "string") {
    return null;
  }

  const path = value.trim();
  if (PRIVATE_INVITE_PATH.test(path) || SHARED_EXCHANGE_PATH.test(path)) {
    return path as AuthReturnPath;
  }

  return null;
}
