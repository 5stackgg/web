export default defineNuxtPlugin(({ $config }) => {
  return {
    httpEndpoint: `https://${$config.public.apiHost}/v1/graphql`,
    httpLinkOptions: {
      credentials: "include",
    },
    wsEndpoint: `ws://${$config.public.apiDomain}/v1/graphql`,
    wsLinkOptions: {
      // @ts-ignore
      credentials: "include",
    },
  };
});
