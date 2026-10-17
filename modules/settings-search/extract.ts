import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "@vue/compiler-sfc";

export type SettingsSearchEntry = {
  path: string;
  section?: string;
  label: string;
  description?: string;
};

type Node = {
  type: number;
  tag?: string;
  props?: any[];
  children?: Node[];
  content?: any;
};

const ELEMENT = 1;
const INTERPOLATION = 5;
const ATTRIBUTE = 6;
const DIRECTIVE = 7;

// Popups, menus and buttons hold action copy, not settings, and anything in a
// closed popup could not be scrolled to anyway. The save bar and tooltips only
// ever show status text.
const SKIP = new Set([
  "Button",
  "button",
  "SettingsSaveBar",
  "FiveStackToolTip",
  "FormMessage",
  "SelectContent",
  "DropdownMenuContent",
  "DialogContent",
  "AlertDialogContent",
  "PopoverContent",
  "SheetContent",
  "TooltipContent",
]);
const LABELS = new Set(["FormLabel", "SettingHeader", "Label"]);
const LABEL_TEXT = new Set(["p", "span", "h2", "h3", "h4", "label", "dt"]);
const HEADINGS = new Set(["h3", "h4"]);
const SECTIONS = new Set(["SettingsSection", "FormSection"]);
const CONTROLS = new Set([
  "Switch",
  "Checkbox",
  "Input",
  "Textarea",
  "Select",
  "NumberField",
  "RadioGroup",
  "Slider",
  "ToggleGroup",
  "Combobox",
  "input",
  "textarea",
  "select",
]);
const MAX_COMPONENT_DEPTH = 3;

const KEY = /(?<![\w.])\$?t\(\s*(["'`])([\w.-]+)\1\s*[,)]/;

// A ternary picks between states ("Importing…" / "Drop a file"), so neither
// side is the setting's name.
function keyIn(expression: string | undefined) {
  if (!expression || /\?[^?.]/.test(expression.replace(/\?\./g, ""))) {
    return;
  }
  return expression.match(KEY)?.[2];
}

function directive(node: Node, name: string) {
  return node.props?.find(
    (prop) => prop.type === DIRECTIVE && prop.name === name,
  );
}

function isConditional(node: Node) {
  return ["if", "else-if", "else"].some((name) => directive(node, name));
}

function attr(node: Node, name: string) {
  for (const prop of node.props ?? []) {
    if (prop.type === ATTRIBUTE && prop.name === name) {
      return prop.value?.content as string | undefined;
    }
    if (
      prop.type === DIRECTIVE &&
      prop.name === "bind" &&
      prop.arg?.content === name
    ) {
      return prop.exp?.content as string | undefined;
    }
  }
}

function hasControl(node: Node): boolean {
  return (node.children ?? []).some(
    (child) =>
      child.type === ELEMENT && (CONTROLS.has(child.tag!) || hasControl(child)),
  );
}

function firstKey(node: Node): string | undefined {
  for (const child of node.children ?? []) {
    const key =
      child.type === INTERPOLATION
        ? keyIn(child.content?.content)
        : child.type === ELEMENT
          ? firstKey(child)
          : undefined;
    if (key) {
      return key;
    }
  }
}

// Hand-rolled labels are bold text or a heading. One that toggles itself with
// v-if is a status badge (Online / Needs 2FA), not the name of a setting.
function isTextLabel(node: Node) {
  const classes = attr(node, "class") ?? "";
  return (
    LABEL_TEXT.has(node.tag!) &&
    (HEADINGS.has(node.tag!) || /\bfont-(medium|semibold)\b/.test(classes)) &&
    !/\btext-destructive\b/.test(classes) &&
    !isConditional(node)
  );
}

// A v-if chain on a count switches between a list and its empty state;
// list rows are data and the empty state is a placeholder, so no branch from
// the count onwards holds a setting.
function listChains(children: Node[]) {
  let list = false;
  return children.map((child) => {
    if (child.type !== ELEMENT) {
      return false;
    }
    const condition = directive(child, "if") ?? directive(child, "else-if");
    if (!condition && !directive(child, "else")) {
      list = false;
    }
    if (condition) {
      list =
        (list && !directive(child, "if")) ||
        /\.length\b|[=!]==?\s*0\b/.test(condition.exp?.content ?? "");
    }
    return list;
  });
}

function isDescription(node: Node) {
  return (
    node.tag === "FormDescription" ||
    (["p", "span"].includes(node.tag!) &&
      /\btext-muted-foreground\b/.test(attr(node, "class") ?? ""))
  );
}

function localImports(source: string, file: string, rootDir: string) {
  const imports = new Map<string, string>();
  const pattern = /import\s+(\w+)\s+from\s+["']([^"']+\.vue)["']/g;
  for (const [, name, specifier] of source.matchAll(pattern)) {
    if (specifier.includes("/ui/")) {
      continue;
    }
    const path = /^[~@]\//.test(specifier)
      ? join(rootDir, specifier.slice(2))
      : specifier.startsWith(".")
        ? resolve(dirname(file), specifier)
        : undefined;
    if (path) {
      imports.set(name, path);
    }
  }
  return imports;
}

/**
 * Reads a settings page's template, and the templates of the local components
 * it renders, for the labels it shows: SettingsSection titles, form labels and
 * the description that sits beside each one. Only static `$t("key")` calls are
 * picked up; the index holds keys, so search runs in whatever locale is active.
 */
export function extractSettingsEntries(
  rootDir: string,
  path: string,
  file: string,
  messages: Record<string, unknown>,
): { entries: SettingsSearchEntry[]; files: string[] } {
  // Text with a {placeholder} only reads right with its runtime values.
  const usable = (key: string | undefined) => {
    const message = key
      ?.split(".")
      .reduce<any>((value, part) => value?.[part], messages);
    return typeof message === "string" && !/\{\w+\}/.test(message)
      ? key
      : undefined;
  };

  const entries: SettingsSearchEntry[] = [];
  const seen = new Set<string>();
  // Bold text alone is as likely a stat or a heading as a setting; it counts
  // once a description or a control sits beside it.
  const textLabels = new Set<SettingsSearchEntry>();
  const files: string[] = [];

  function visitFile(file: string, section: string | undefined, depth: number) {
    if (files.includes(file)) {
      return;
    }
    files.push(file);

    const source = readFileSync(file, "utf8");
    const { descriptor } = parse(source, { filename: file });
    if (!descriptor.template?.ast) {
      return;
    }
    const imports = localImports(source, file, rootDir);

    // A description belongs to the label it shares a parent or grandparent
    // with, which covers both FormItem rows and hand-rolled label stacks.
    let last: { entry: SettingsSearchEntry; scope: Node[] } | undefined;

    function push(entry: SettingsSearchEntry, scope: Node[]) {
      if (!usable(entry.label) || seen.has(entry.label)) {
        last = undefined;
        return;
      }
      seen.add(entry.label);
      entries.push(entry);
      last = { entry, scope };
    }

    function walk(node: Node, section: string | undefined, ancestors: Node[]) {
      if (node.type !== ELEMENT || SKIP.has(node.tag!)) {
        return;
      }
      const scope = ancestors.slice(-2);
      // Any static id is somewhere to scroll to; a bound one is per-row.
      section =
        node.props?.find(
          (prop) => prop.type === ATTRIBUTE && prop.name === "id",
        )?.value?.content ?? section;

      if (SECTIONS.has(node.tag!)) {
        const label = keyIn(attr(node, "title"));
        if (label) {
          push(
            {
              path,
              section,
              label,
              description: usable(keyIn(attr(node, "description"))),
            },
            [node],
          );
        }
      } else if (LABELS.has(node.tag!) || isTextLabel(node)) {
        const label = firstKey(node);
        if (label) {
          const entry = { path, section, label };
          push(entry, scope);
          if (!LABELS.has(node.tag!) && !scope.some(hasControl)) {
            textLabels.add(entry);
          }
        }
        return;
      } else if (isDescription(node)) {
        const description = usable(firstKey(node));
        if (
          description &&
          last &&
          !last.entry.description &&
          last.scope.some((parent) => scope.includes(parent))
        ) {
          last.entry.description = description;
        }
        return;
      }

      const component = imports.get(node.tag!);
      if (component && depth < MAX_COMPONENT_DEPTH) {
        visitFile(component, section, depth + 1);
      }

      walkChildren(node.children ?? [], section, [...ancestors, node]);
    }

    function walkChildren(
      children: Node[],
      section: string | undefined,
      ancestors: Node[],
    ) {
      const lists = listChains(children);
      children.forEach((child, index) => {
        if (!lists[index]) {
          walk(child, section, ancestors);
        }
      });
    }

    walkChildren(descriptor.template.ast.children as Node[], section, []);
  }

  visitFile(file, undefined, 0);

  return {
    entries: entries.filter(
      (entry) => entry.description || !textLabels.has(entry),
    ),
    files,
  };
}

export const SETTINGS_PAGES_DIR = "pages/settings";
export const SETTINGS_LOCALE_FILE = "i18n/locales/en.json";

/**
 * Every settings page, account and application, read into one index. `files`
 * is what it was read from, so a dev server knows which edits mean rebuilding
 * it.
 */
export function buildSettingsSearchIndex(rootDir: string) {
  const pagesDir = join(rootDir, SETTINGS_PAGES_DIR);
  const localeFile = join(rootDir, SETTINGS_LOCALE_FILE);
  const messages = JSON.parse(readFileSync(localeFile, "utf8"));
  const entries: SettingsSearchEntry[] = [];
  const files = new Set([localeFile]);

  for (const file of readdirSync(pagesDir, { recursive: true }) as string[]) {
    // A [param] page has no fixed URL.
    if (!file.endsWith(".vue") || file.includes("[")) {
      continue;
    }
    const route = file.replace(/(^|\/)index\.vue$|\.vue$/, "");
    const page = extractSettingsEntries(
      rootDir,
      `/settings${route && `/${route}`}`,
      join(pagesDir, file),
      messages,
    );
    entries.push(...page.entries);
    page.files.forEach((read) => files.add(read));
  }

  return { entries, files };
}
