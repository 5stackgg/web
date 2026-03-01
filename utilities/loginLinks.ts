export const loginLinks = {
  steam: `https://${useRuntimeConfig().public.webDomain}/auth/steam?redirect=${encodeURIComponent(
    window.location.toString(),
    )}`,
  discord: `https://${useRuntimeConfig().public.webDomain}/auth/discord`,
};