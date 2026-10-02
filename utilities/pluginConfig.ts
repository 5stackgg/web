export type CvarKind = "bool" | "int" | "float" | "string";

export type PluginCvar = {
  name: string;
  kind: CvarKind | null;
  defaultValue: string | null;
  description: string | null;
};

export type JsonSchema = {
  type?: "object" | "array" | "string" | "integer" | "number" | "boolean";
  title?: string;
  description?: string;
  enum?: Array<unknown>;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  required?: Array<string>;
  uniqueItems?: boolean;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

function nameOf(line: string): string | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("//")) {
    return null;
  }

  return trimmed.split(/\s+/)[0].toLowerCase();
}

// A quoted value runs to its closing quote, so a URL's "//" is not read as
// the start of a comment. A name with nothing after it sets nothing.
function valueOf(line: string): string | null {
  const rest = line.trim().replace(/^\S+\s*/, "");

  if (rest.startsWith('"')) {
    const end = rest.indexOf('"', 1);

    return end === -1 ? rest.slice(1) : rest.slice(1, end);
  }

  const value = rest.split(/\s+|\/\//)[0] ?? "";

  return value === "" ? null : value;
}

export function cvarsSetIn(cfg: string): Set<string> {
  return new Set(
    (cfg ?? "")
      .split("\n")
      .map(nameOf)
      .filter((name): name is string => !!name),
  );
}

// The last line wins, as it does when the server execs the file.
export function readCvar(cfg: string, name: string): string | null {
  const wanted = name.toLowerCase();
  const line = (cfg ?? "")
    .split("\n")
    .filter((entry) => nameOf(entry) === wanted)
    .pop();

  return line === undefined ? null : valueOf(line);
}

// CounterStrikeSharp hands a quoted argument to a number or bool cvar with
// the quotes still on and fails to parse it, so only a string, or a value
// that would not survive unquoted, gets them.
function formatValue(value: string, kind: CvarKind | null): string {
  const needsQuotes =
    kind === "string" || value === "" || /[\s;]|\/\//.test(value);

  return needsQuotes ? `"${value.replace(/"/g, "")}"` : value;
}

// Rewrites the first line that sets the cvar and drops any later ones, so the
// operator's comments and ordering survive an edit made from the form.
export function writeCvar(
  cfg: string,
  name: string,
  value: string | null,
  kind: CvarKind | null,
): string {
  const wanted = name.toLowerCase();
  const formatted =
    value === null ? null : `${name} ${formatValue(value, kind)}`;

  const lines = (cfg ?? "").split("\n");
  const kept: Array<string> = [];
  let written = false;

  for (const line of lines) {
    if (nameOf(line) !== wanted) {
      kept.push(line);
      continue;
    }

    if (formatted !== null && !written) {
      kept.push(formatted);
      written = true;
    }
  }

  if (formatted !== null && !written) {
    while (kept.length > 0 && kept[kept.length - 1].trim() === "") {
      kept.pop();
    }

    kept.push(formatted, "");
  }

  return kept.join("\n");
}

export function isTruthy(value: string | null): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

// The subset of JSON Schema the config form renders; the registry holds a
// plugin's shipped default to the same rules.
export function schemaProblems(
  schema: JsonSchema,
  value: unknown,
  at = "",
): Array<string> {
  const type = schema?.type;
  const label = at || schema?.title || "config";

  const matches =
    type === undefined ||
    (type === "array" && Array.isArray(value)) ||
    (type === "object" &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)) ||
    (type === "string" && typeof value === "string") ||
    (type === "boolean" && typeof value === "boolean") ||
    (type === "number" && typeof value === "number") ||
    (type === "integer" && Number.isInteger(value));

  if (!matches) {
    return [`${label}: expected ${type}`];
  }

  const problems: Array<string> = [];

  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(`${label}: ${JSON.stringify(value)} is not an option`);
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      problems.push(`${label}: at least ${schema.minimum}`);
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      problems.push(`${label}: at most ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.uniqueItems) {
      const seen = new Set<string>();

      for (const item of value) {
        const key = JSON.stringify(item);

        if (seen.has(key)) {
          problems.push(`${label}: ${key} is listed twice`);
        }

        seen.add(key);
      }
    }

    value.forEach((item, index) => {
      problems.push(
        ...schemaProblems(schema.items ?? {}, item, `${label}[${index + 1}]`),
      );
    });
  }

  if (type === "object" && value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of schema.required ?? []) {
      if (record[key] === undefined || record[key] === "") {
        problems.push(`${label}.${key}: required`);
      }
    }

    for (const [key, item] of Object.entries(record)) {
      const property = schema.properties?.[key];

      if (property && item !== undefined) {
        problems.push(...schemaProblems(property, item, `${label}.${key}`));
      }
    }
  }

  return problems;
}

// A blank entry for an array the form is adding to: each property's own
// default where it has one, an empty value of the right shape where not.
export function blankFor(schema: JsonSchema): unknown {
  if (schema.default !== undefined) {
    return structuredClone(schema.default);
  }

  switch (schema.type) {
    case "object":
      return Object.fromEntries(
        (schema.required ?? []).map((key) => [
          key,
          blankFor(schema.properties?.[key] ?? {}),
        ]),
      );
    case "array":
      return [];
    case "boolean":
      return false;
    case "integer":
    case "number":
      return schema.minimum ?? 0;
    case "string":
      return Array.isArray(schema.enum) && schema.enum.length > 0
        ? schema.enum[0]
        : "";
    default:
      return null;
  }
}

// The release a node installed is the tag its download came from, which is
// what the "view in repo" link should open rather than the default branch.
export function repoFileUrl(
  releaseUrl: string | null | undefined,
  repoPath: string | null | undefined,
): string | null {
  const match = releaseUrl?.match(
    /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/releases\/download\/([^/]+)\//i,
  );

  if (!match || !repoPath) {
    return null;
  }

  return `https://github.com/${match[1]}/blob/${match[2]}/${repoPath.replace(/^\/+/, "")}`;
}
