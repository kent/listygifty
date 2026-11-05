// Only same-site paths, so a redirect_url can't send anyone off-site.
export function safeRedirect(value: string | null, fallback = "/dashboard") {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}
