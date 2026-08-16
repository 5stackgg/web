// An absolute URL for a *different device* to open -- what goes into a QR code.
//
// Deliberately not webDomain. That one names where the API's own web-domain
// routes live (/auth/steam, /discord-invite, see base/api/ingress.yaml), which
// behind a dev tunnel is still the deployed panel even though the app someone
// is looking at is being served from the tunnel. Pointing a QR at it there
// sends the phone to production, which looks exactly like the page working.
export function deviceUrl(path: string) {
  const config = useRuntimeConfig().public;

  return `https://${config.deviceDomain || config.webDomain}/${path}`;
}
