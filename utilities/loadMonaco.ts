type MonacoModule = typeof import("monaco-editor");

let monacoPromise: Promise<MonacoModule> | null = null;
let monacoConfigured = false;

export async function loadMonaco() {
  if (import.meta.server) {
    throw new Error("Monaco can only be loaded on the client.");
  }

  if (!monacoPromise) {
    monacoPromise = (async () => {
      const [
        monaco,
        { default: EditorWorker },
        { default: JsonWorker },
        { default: CssWorker },
        { default: HtmlWorker },
        { default: TsWorker },
      ] = await Promise.all([
        import("monaco-editor"),
        import("monaco-editor/esm/vs/editor/editor.worker?worker"),
        import("monaco-editor/esm/vs/language/json/json.worker?worker"),
        import("monaco-editor/esm/vs/language/css/css.worker?worker"),
        import("monaco-editor/esm/vs/language/html/html.worker?worker"),
        import("monaco-editor/esm/vs/language/typescript/ts.worker?worker"),
      ]);

      if (!monacoConfigured) {
        (
          self as typeof self & {
            MonacoEnvironment?: {
              getWorker: (_: unknown, label: string) => Worker;
            };
          }
        ).MonacoEnvironment = {
          getWorker(_: unknown, label: string) {
            if (label === "json") {
              return new JsonWorker();
            }
            if (label === "css" || label === "scss" || label === "less") {
              return new CssWorker();
            }
            if (label === "html" || label === "handlebars" || label === "razor") {
              return new HtmlWorker();
            }
            if (label === "typescript" || label === "javascript") {
              return new TsWorker();
            }
            return new EditorWorker();
          },
        };
        monacoConfigured = true;
      }

      return monaco;
    })();
  }

  return monacoPromise;
}
