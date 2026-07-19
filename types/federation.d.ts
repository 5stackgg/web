/**
 * Runtime API surfaced by @originjs/vite-plugin-federation when the host has the
 * federation() plugin configured. Used to register + load plugin remotes
 * dynamically from the custom_pages registry.
 */
declare module "__federation__" {
  interface RemoteConfig {
    url: (() => string | Promise<string>) | string;
    format: "esm" | "systemjs" | "var";
    from: "vite" | "webpack";
  }

  export function __federation_method_setRemote(
    name: string,
    config: RemoteConfig,
  ): void;

  export function __federation_method_getRemote(
    name: string,
    exposedPath: string,
  ): Promise<Record<string, unknown>>;

  export function __federation_method_unwrapDefault<T = unknown>(
    module: Record<string, unknown>,
  ): Promise<T>;
}
