import {
  cleanupNonNestedPath,
  isNotNestedPath,
  type TypedSchema,
} from "vee-validate";

type ZodIssueLike = {
  code: string;
  path: Array<string | number>;
  message: string;
  unionErrors?: Array<{ issues: ZodIssueLike[] }>;
  errors?: ZodIssueLike[][];
};

type ZodSchemaLike = {
  _def?: Record<string, any>;
  shape?: Record<string, ZodSchemaLike>;
  isOptional(): boolean;
  parse(value: unknown): unknown;
  safeParseAsync(
    value: unknown,
    opts?: unknown,
  ): Promise<
    | { success: true; data: unknown }
    | { success: false; error: { issues: ZodIssueLike[] } }
  >;
};

type VeeValidateError = {
  errors: string[];
  path: string;
};

const isObject = (obj: unknown): obj is Record<string, unknown> =>
  obj !== null && !!obj && typeof obj === "object" && !Array.isArray(obj);

function isIndex(value: string) {
  return Number(value) >= 0;
}

function isObjectLike(value: unknown) {
  return typeof value === "object" && value !== null;
}

function getTag(value: unknown) {
  if (value == null) {
    return value === undefined ? "[object Undefined]" : "[object Null]";
  }

  return Object.prototype.toString.call(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObjectLike(value) || getTag(value) !== "[object Object]") {
    return false;
  }

  if (Object.getPrototypeOf(value) === null) {
    return true;
  }

  let proto = value;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }

  return Object.getPrototypeOf(value) === proto;
}

function merge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) {
  Object.keys(source).forEach((key) => {
    if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      if (!target[key]) {
        target[key] = {};
      }

      merge(target[key], source[key]);
      return;
    }

    target[key] = source[key];
  });

  return target;
}

function normalizeFormPath(path: string) {
  const pathArr = path.split(".");
  if (!pathArr.length) {
    return "";
  }

  let fullPath = String(pathArr[0]);
  for (let i = 1; i < pathArr.length; i++) {
    if (isIndex(pathArr[i])) {
      fullPath += `[${pathArr[i]}]`;
      continue;
    }

    fullPath += `.${pathArr[i]}`;
  }

  return fullPath;
}

export function toTypedSchema<TSchema extends ZodSchemaLike>(
  zodSchema: TSchema,
  opts?: unknown,
): TypedSchema<any, any> {
  return {
    __type: "VVTypedSchema",
    async parse(value) {
      const result = await zodSchema.safeParseAsync(value, opts);

      if (result.success) {
        return {
          value: result.data,
          errors: [],
        };
      }

      const errors: Record<string, VeeValidateError> = {};
      processIssues(result.error.issues, errors);

      return {
        errors: Object.values(errors),
      };
    },
    cast(values) {
      try {
        return zodSchema.parse(values);
      } catch {
        const defaults = getDefaults(zodSchema);

        if (isObject(defaults) && isObject(values)) {
          return merge(defaults, values);
        }

        return values;
      }
    },
    describe(path) {
      try {
        if (!path) {
          return {
            required: !zodSchema.isOptional(),
            exists: true,
          };
        }

        const description = getSchemaForPath(path, zodSchema);

        if (!description) {
          return {
            required: false,
            exists: false,
          };
        }

        return {
          required: !description.isOptional(),
          exists: true,
        };
      } catch {
        if (import.meta.dev) {
          console.warn(
            `Failed to describe path ${path} on the schema, returning a default description.`,
          );
        }

        return {
          required: false,
          exists: false,
        };
      }
    },
  };
}

function processIssues(
  issues: ZodIssueLike[],
  errors: Record<string, VeeValidateError>,
) {
  issues.forEach((issue) => {
    const path = normalizeFormPath(issue.path.join("."));

    if (issue.code === "invalid_union") {
      if (issue.unionErrors) {
        processIssues(
          issue.unionErrors.flatMap((unionError) => unionError.issues),
          errors,
        );
      }

      if (issue.errors) {
        processIssues(issue.errors.flat(), errors);
      }

      if (!path) {
        return;
      }
    }

    if (!errors[path]) {
      errors[path] = { errors: [], path };
    }

    errors[path].errors.push(issue.message);
  });
}

function getDefaults(
  schema: ZodSchemaLike,
): Record<string, unknown> | undefined {
  if (!isObjectSchema(schema)) {
    return undefined;
  }

  const shape = getShape(schema);

  return Object.fromEntries(
    Object.entries(shape).map(([key, value]) => {
      if (isDefaultSchema(value)) {
        return [key, getDefaultValue(value)];
      }

      if (isObjectSchema(value)) {
        return [key, getDefaults(value)];
      }

      return [key, undefined];
    }),
  );
}

const toFieldValidator = toTypedSchema;
const toFormValidator = toTypedSchema;

export { toFieldValidator, toFormValidator };

function getSchemaForPath(path: string, schema: ZodSchemaLike) {
  if (!isObjectSchema(schema)) {
    return null;
  }

  if (isNotNestedPath(path)) {
    return getShape(schema)[cleanupNonNestedPath(path)] ?? null;
  }

  const paths = path.split(/\.|\[(\d+)\]/).filter(Boolean);
  let currentSchema: ZodSchemaLike | null = schema;

  for (let i = 0; i <= paths.length; i++) {
    const p = paths[i];

    if (!p || !currentSchema) {
      return currentSchema;
    }

    if (isObjectSchema(currentSchema)) {
      currentSchema = getShape(currentSchema)[p] ?? null;
      continue;
    }

    if (isIndex(p) && isArraySchema(currentSchema)) {
      currentSchema = getArrayElement(currentSchema);
    }
  }

  return null;
}

function getDefType(schema: ZodSchemaLike) {
  return schema._def?.typeName ?? schema._def?.type;
}

function isArraySchema(schema: ZodSchemaLike) {
  const defType = getDefType(schema);
  return defType === "ZodArray" || defType === "array";
}

function isDefaultSchema(schema: ZodSchemaLike) {
  const defType = getDefType(schema);
  return defType === "ZodDefault" || defType === "default";
}

function isObjectSchema(schema: ZodSchemaLike) {
  const defType = getDefType(schema);
  return defType === "ZodObject" || defType === "object" || !!schema.shape;
}

function getShape(schema: ZodSchemaLike) {
  if (schema.shape) {
    return schema.shape;
  }

  if (typeof schema._def?.shape === "function") {
    return schema._def.shape();
  }

  return schema._def?.shape ?? {};
}

function getDefaultValue(schema: ZodSchemaLike) {
  const defaultValue = schema._def?.defaultValue;

  if (typeof defaultValue === "function") {
    return defaultValue();
  }

  return defaultValue;
}

function getArrayElement(schema: ZodSchemaLike) {
  const element = schema._def?.element ?? schema._def?.type;
  return typeof element === "object" ? element : null;
}
