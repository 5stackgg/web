export type SocketCallback<T = string | boolean | Record<string, unknown>> = (
  data: T,
) => void;
