const ANDROID_PACKAGE_NAME = "com.niftygifty.app";

type AndroidAssetLink = {
  relation: string[];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
};

function parseFingerprints(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\n,;]+/)
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);
}

export function buildAndroidAssetLinks(
  rawFingerprints = process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS
): AndroidAssetLink[] {
  const fingerprints = parseFingerprints(rawFingerprints);

  if (fingerprints.length === 0) {
    return [];
  }

  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
