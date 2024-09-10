export default defineNuxtPlugin(({ $config }) => {
  return {
    httpEndpoint: `${$config.public.apiHost}/v1/graphql`,
    httpLinkOptions: {
      credentials: "include",
    },
    wsEndpoint: `${$config.public.apiHost.replace(/^http/, "ws")}/v1/graphql`,
    wsLinkOptions: {
      // @ts-ignore
      credentials: "include",
    },
  };
});
