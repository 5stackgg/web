export default function getGraphqlClient() {
  const { clients } = useApollo();

  if (!clients?.default) {
    throw Error("missing client");
  }

  return clients.default;
}
