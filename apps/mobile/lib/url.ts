const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const HOSTNAME_LIKE_PATTERN = /^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:[/#?].*)?$/i;

const MERCHANT_LABELS: Array<[RegExp, string]> = [
  [/(\.|^)amazon\./i, "Amazon"],
  [/(\.|^)amzn\.to$/i, "Amazon"],
  [/(\.|^)target\./i, "Target"],
  [/(\.|^)walmart\./i, "Walmart"],
  [/(\.|^)etsy\./i, "Etsy"],
  [/(\.|^)bestbuy\./i, "Best Buy"],
  [/(\.|^)lego\./i, "LEGO"],
  [/(\.|^)apple\./i, "Apple"],
  [/(\.|^)indigo\./i, "Indigo"],
];

export function normalizeExternalUrl(rawUrl: string | null | undefined): string {
  const value = rawUrl?.trim() ?? "";
  if (!value) {
    return "";
  }

  if (URL_SCHEME_PATTERN.test(value)) {
    return value;
  }

  if (HOSTNAME_LIKE_PATTERN.test(value)) {
    return `https://${value}`;
  }

  return value;
}

export function getHostnameFromUrl(rawUrl: string | null | undefined): string | null {
  const normalizedUrl = normalizeExternalUrl(rawUrl);
  if (!normalizedUrl) {
    return null;
  }

  try {
    return new URL(normalizedUrl).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

export function getMerchantLabel(rawUrl: string | null | undefined): string | null {
  const hostname = getHostnameFromUrl(rawUrl);
  if (!hostname) {
    return null;
  }

  const knownMerchant = MERCHANT_LABELS.find(([pattern]) => pattern.test(hostname));
  return knownMerchant?.[1] ?? hostname;
}
