const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim();

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const siteUrl = withoutTrailingSlash(configuredSiteUrl || window.location.origin);

export const authRedirectUrls = {
  emailConfirmation: siteUrl,
  passwordRecovery: `${siteUrl}/login`,
} as const;
