// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { decompile, missingOutput, tailLines } from "~/scripts/lib-s2v.mjs";
import { installFakeSourceViewer } from "../helpers/fakeMapTools";

// What Source2Viewer-CLI 20.0 prints when a render world is over the .glb cap:
// the exception on stderr, and nothing else to say it failed.
const TOO_BIG = [
  "File: maps/de_big/world.vwrld_c (parent: /cs2/game/csgo/maps/de_big.vpk)",
  "System.NotSupportedException: VRF does not properly support big model (>=2GiB) " +
    "exports yet due to glTF limitations. Try exporting as .gltf, not .glb.",
  "   at ValveResourceFormat.IO.GltfModelExporter.WriteModelFile(ModelRoot exportedModel)",
  "   at ValveResourceFormat.IO.GltfModelExporter.Export(Resource resource, String targetPath)",
  "",
].join("\n");

describe("tailLines", () => {
  it("keeps an exception's file and message, not its stack frames", () => {
    expect(tailLines(TOO_BIG, 6)).toEqual([
      "File: maps/de_big/world.vwrld_c",
      expect.stringMatching(/^System\.NotSupportedException: VRF does not properly support big model/),
    ]);
  });

  it("folds a run of lines that differ only in what they quote", () => {
    const text = [
      'Failed to load "models/a.vmdl_c"',
      'Failed to load "models/b.vmdl_c"',
      'Failed to load "models/c.vmdl_c"',
      "\x1b[36mFile: maps/x/world.vwrld_c\x1b[0m",
      "",
      "System.IO.IOException: disk full",
    ].join("\n");
    expect(tailLines(text, 6)).toEqual([
      'Failed to load "models/a.vmdl_c" (+2 like it)',
      "File: maps/x/world.vwrld_c",
      "System.IO.IOException: disk full",
    ]);
  });

  it("keeps only the last lines, each cut to a readable length", () => {
    const text = ["one", "two", "three", "x".repeat(1000)].join("\n");
    const tail = tailLines(text, 2);
    expect(tail[0]).toBe("three");
    expect(tail[1].length).toBeLessThan(400);
    expect(tail[1].endsWith("…")).toBe(true);
  });
});

describe("decompile", () => {
  const dir = mkdtempSync(join(tmpdir(), "lib-s2v-"));
  const cli = installFakeSourceViewer(dir);
  const out = join(dir, "out");
  const cwdLog = join(dir, "cwd.log");
  mkdirSync(out);

  const run = (plan: unknown, output: Record<string, unknown> = {}) => {
    process.env.FAKE_S2V = JSON.stringify({ "maps/de_big/world.vwrld_c": plan });
    process.env.FAKE_S2V_OUTPUT = JSON.stringify(output);
    process.env.FAKE_S2V_CWD_LOG = cwdLog;
    return decompile(cli, join(dir, "de_big.vpk"), "maps/de_big/world.vwrld_c", out, [
      "--gltf_export_format",
      "glb",
    ]);
  };

  afterEach(() => {
    delete process.env.FAKE_S2V;
    delete process.env.FAKE_S2V_OUTPUT;
    delete process.env.FAKE_S2V_CWD_LOG;
    rmSync(cwdLog, { force: true });
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("hands back what a silently failed export said, however much it printed", () => {
    const said = run(
      {},
      {
        "maps/de_big/world.vwrld_c": {
          stdout: '--- Dump written to "maps/de_big/worldnodes/n0.vmdl"\n',
          repeat: 40000,
          stderr: TOO_BIG,
        },
      },
    );
    expect(said.stderr).toEqual([
      "File: maps/de_big/world.vwrld_c",
      expect.stringMatching(/NotSupportedException: .*>=2GiB/),
    ]);
    expect(said.stdout).toEqual([
      expect.stringMatching(/^--- Dump written to "maps\/de_big\/worldnodes\/n0\.vmdl" \(\+\d+ like it\)$/),
    ]);
    expect(missingOutput("world.glb", said).message).toMatch(
      /^no world\.glb came out \(Source2Viewer-CLI said: File: maps\/de_big\/world\.vwrld_c \| System\.NotSupportedException: .* -- stdout: /,
    );
  });

  it("runs the CLI in a scratch directory, so its exceptions.txt goes with it", () => {
    run({}, { "maps/de_big/world.vwrld_c": { stderr: TOO_BIG } });
    const [cwd] = readFileSync(cwdLog, "utf8").trim().split("\n");
    expect(cwd).not.toBe(process.cwd());
    expect(existsSync(cwd)).toBe(false);
  });

  it("says the CLI printed nothing when it did not", () => {
    expect(missingOutput("world.glb", run({})).message).toBe(
      "no world.glb came out (Source2Viewer-CLI printed nothing)",
    );
  });

  it("throws with the exit status and stderr when the CLI fails", () => {
    expect(() => run("FAIL")).toThrow(
      "Source2Viewer-CLI failed on maps/de_big/world.vwrld_c (exit 3): simulated export failure",
    );
  });
});
