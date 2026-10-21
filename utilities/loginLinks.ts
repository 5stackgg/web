export function signInWithSteam() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

export const loginLinks = {
  steam: `https://${useRuntimeConfig().public.webDomain}/auth/steam`,
  discord: `https://${useRuntimeConfig().public.webDomain}/auth/discord`,
};
