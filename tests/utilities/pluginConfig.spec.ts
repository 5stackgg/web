// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  blankFor,
  cvarsSetIn,
  readCvar,
  repoFileUrl,
  schemaProblems,
  writeCvar,
  type JsonSchema,
} from "~/utilities/pluginConfig";

const cfg = [
  "// set by the inventory app",
  'invsim_url "https://inventory.5stack.gg" // ours',
  "invsim_ws_enabled 1",
  "",
].join("\n");

describe("readCvar", () => {
  it("reads a quoted URL whole, ignoring the comment after it", () => {
    expect(readCvar(cfg, "invsim_url")).toEqual("https://inventory.5stack.gg");
  });

  it("reads a bare value and nothing for an unset cvar", () => {
    expect(readCvar(cfg, "invsim_ws_enabled")).toEqual("1");
    expect(readCvar(cfg, "invsim_apikey")).toBeNull();
  });

  // What "Insert the plugin's cvars" writes: a name waiting for a value.
  it("reads a name with no value as not set", () => {
    expect(
      readCvar("dm_replenish_health \n", "dm_replenish_health"),
    ).toBeNull();
    expect(readCvar('dm_pro_ratio ""', "dm_pro_ratio")).toEqual("");
  });

  it("takes the last line, as the server does", () => {
    expect(readCvar("dm_pro_ratio 1\ndm_pro_ratio 2", "dm_pro_ratio")).toEqual(
      "2",
    );
  });
});

describe("writeCvar", () => {
  it("replaces a value in place and keeps comments", () => {
    expect(writeCvar(cfg, "invsim_ws_enabled", "0", "bool")).toEqual(
      [
        "// set by the inventory app",
        'invsim_url "https://inventory.5stack.gg" // ours',
        "invsim_ws_enabled 0",
        "",
      ].join("\n"),
    );
  });

  it("appends a cvar that is not set, quoting a string", () => {
    expect(
      writeCvar("mp_freezetime 3\n\n", "dm_chat_prefix", "[DM]", "string"),
    ).toEqual('mp_freezetime 3\ndm_chat_prefix "[DM]"\n');
  });

  it("removes every line for a cvar put back to its default", () => {
    expect(
      writeCvar(
        "a 1\ndm_pro_ratio 1\nb 2\ndm_pro_ratio 2\n",
        "dm_pro_ratio",
        null,
        "float",
      ),
    ).toEqual("a 1\nb 2\n");
  });

  // CounterStrikeSharp parses a quoted number or bool with the quotes on and
  // rejects it, and a CSS plugin's cvars are never reported with a kind.
  it("leaves a value unquoted when the kind is unknown and it does not need them", () => {
    expect(writeCvar("", "dm_replenish_health", "25", null)).toEqual(
      "dm_replenish_health 25\n",
    );
    expect(writeCvar("", "invsim_ws_enabled", "1", null)).toEqual(
      "invsim_ws_enabled 1\n",
    );
  });

  it("quotes a value that would not survive unquoted", () => {
    expect(writeCvar("", "dm_chat_prefix", "[Death match]", null)).toEqual(
      'dm_chat_prefix "[Death match]"\n',
    );
    expect(
      writeCvar("", "invsim_url", "https://inventory.5stack.gg", null),
    ).toEqual('invsim_url "https://inventory.5stack.gg"\n');
  });

  it("collapses duplicates onto the first line", () => {
    expect(writeCvar("x 1\ny 2\nx 3", "x", "4", "int")).toEqual("x 4\ny 2");
  });
});

describe("cvarsSetIn", () => {
  it("names each cvar a cfg sets, lowercased, skipping comments", () => {
    expect([
      ...cvarsSetIn("// bot_quota 5\nBOT_QUOTA 10\n mp_timelimit 2"),
    ]).toEqual(["bot_quota", "mp_timelimit"]);
  });
});

const modes: JsonSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["name", "duration"],
    properties: {
      name: { type: "string" },
      duration: { type: "integer", minimum: 1 },
      helmet: { type: "boolean", default: true },
      weapons: {
        type: "array",
        items: { type: "string", enum: ["ak47", "awp"] },
      },
    },
  },
};

describe("schemaProblems", () => {
  it("accepts a valid config", () => {
    expect(
      schemaProblems(modes, [
        { name: "Rifles", duration: 60, weapons: ["ak47"] },
      ]),
    ).toEqual([]);
  });

  it("names what is wrong and where", () => {
    expect(
      schemaProblems(modes, [{ name: "", duration: 0, weapons: ["knife"] }]),
    ).toEqual([
      "config[1].name: required",
      "config[1].duration: at least 1",
      'config[1].weapons[1]: "knife" is not an option',
    ]);
  });
});

describe("schemaProblems with uniqueItems", () => {
  // The Deathmatch plugin drops its whole modes file on a repeated weapon.
  it("rejects a value listed twice", () => {
    expect(
      schemaProblems(
        { type: "array", uniqueItems: true, items: { type: "string" } },
        ["ak47", "awp", "ak47"],
      ),
    ).toEqual(['config: "ak47" is listed twice']);
  });
});

describe("blankFor", () => {
  it("starts a new entry from the schema's required fields", () => {
    expect(blankFor(modes.items as JsonSchema)).toEqual({
      name: "",
      duration: 1,
    });
  });
});

describe("repoFileUrl", () => {
  it("links the file at the installed release's tag", () => {
    expect(
      repoFileUrl(
        "https://github.com/ianlucas/cs2-ss2-deathmatch/releases/download/v1.1.2/Deathmatch-v1.1.2.zip",
        "resources/configs/default.json",
      ),
    ).toEqual(
      "https://github.com/ianlucas/cs2-ss2-deathmatch/blob/v1.1.2/resources/configs/default.json",
    );
  });

  it("has no link for a download that is not a GitHub release", () => {
    expect(
      repoFileUrl("https://example.test/plugin.zip", "default.json"),
    ).toBeNull();
  });
});
