// Source2Viewer-CLI plumbing shared by the map extractors.
//
// The CLI is a self-contained ValveResourceFormat build, fetched once into
// `.cache/s2v/` unless CLI names one already on disk -- which is how these run
// in-cluster, where the inventory plugin's model extraction has already put one
// at /cs2-models/.work/cs2-model-extract/cli/Source2Viewer-CLI.
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".cache", "s2v");

const TAIL_BYTES = 64 * 1024;
const TAIL_LINE_CHARS = 300;
const STDERR_LINES = 6;
const STDOUT_LINES = 3;

export function resolveCli() {
  if (process.env.CLI) {
    return process.env.CLI;
  }
  const existing = existsSync(cliDir)
    ? readdirSync(cliDir).find((f) => f.includes("CLI") && !f.endsWith(".zip"))
    : null;
  if (existing) {
    return join(cliDir, existing);
  }

  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const os =
    process.platform === "darwin"
      ? "macos"
      : process.platform === "win32"
        ? "windows"
        : "linux";
  const asset = `cli-${os}-${arch}.zip`;

  console.log(`↓ fetching Source2Viewer-CLI (${asset})…`);
  const releases = execFileSync("curl", [
    "-sL",
    "https://api.github.com/repos/ValveResourceFormat/ValveResourceFormat/releases/latest",
  ]).toString();
  const url = JSON.parse(releases).assets?.find((a) => a.name === asset)?.browser_download_url;
  if (!url) {
    throw new Error(
      `no ${asset} in the latest ValveResourceFormat release — set CLI=<path to Source2Viewer-CLI>`,
    );
  }

  mkdirSync(cliDir, { recursive: true });
  const zip = join(cliDir, "cli.zip");
  execFileSync("curl", ["-sL", url, "-o", zip]);
  execFileSync("unzip", ["-o", "-q", zip, "-d", cliDir]);
  rmSync(zip, { force: true });
  const cli = join(
    cliDir,
    readdirSync(cliDir).find((f) => f.includes("CLI") && !f.endsWith(".zip")),
  );
  execFileSync("chmod", ["+x", cli]);

  // Gatekeeper quarantines anything unzipped from a download, and a quarantined
  // binary dies with SIGKILL and no message -- which reads as "the CLI is
  // broken" rather than "macOS refused to run it".
  if (process.platform === "darwin") {
    try {
      execFileSync("xattr", ["-dr", "com.apple.quarantine", cliDir]);
    } catch {
      // no quarantine attribute to clear
    }
  }

  return cli;
}

function readTail(path) {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const length = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, size - length);
    const text = buf.toString("utf8");
    return length < size ? text.slice(text.indexOf("\n") + 1) : text;
  } finally {
    closeSync(fd);
  }
}

/**
 * The last `count` lines worth reading out of a CLI log. Stack frames go, so
 * an exception comes down to its `File:` and `Type: message` lines; and a run
 * of lines that differ only in what they quote is one line -- a render-world
 * export prints `Failed to load "<model>"` for every prop that lives in
 * pak01, and hundreds of those would bury the one line that matters.
 */
export function tailLines(text, count) {
  const lines = [];
  for (const raw of text.replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n/)) {
    if (!raw.trim() || /^\s+at /.test(raw) || /^\s+--- End of /.test(raw)) {
      continue;
    }
    const line = raw.trim().replace(/ \(parent: [^)]*\)$/, "");
    const shape = line.replace(/"[^"]*"/g, '""');
    const last = lines[lines.length - 1];
    if (last?.shape === shape) {
      last.more += 1;
      continue;
    }
    lines.push({ line, shape, more: 0 });
  }
  return lines.slice(-count).map(({ line, more }) => {
    const text = line.length > TAIL_LINE_CHARS ? `${line.slice(0, TAIL_LINE_CHARS)}…` : line;
    return more ? `${text} (+${more} like it)` : text;
  });
}

/** A run's two tails as one line, "" when the CLI printed nothing. */
export function describeOutput({ stderr, stdout }) {
  const parts = [];
  if (stderr.length) {
    parts.push(stderr.join(" | "));
  }
  if (stdout.length) {
    parts.push(`stdout: ${stdout.join(" | ")}`);
  }
  return parts.join(" -- ");
}

/**
 * Why an export that should have written `what` did not: the tail of what the
 * CLI printed while running it.
 */
export function missingOutput(what, run) {
  const said = run ? describeOutput(run) : "";
  return new Error(
    `no ${what} came out (Source2Viewer-CLI ${said ? `said: ${said}` : "printed nothing"})`,
  );
}

/**
 * Decompile one VPK entry, or a whole folder if the path ends in a slash.
 * `extra` carries export flags such as --gltf_export_format. Returns the tail
 * of both streams, `{ stderr, stdout }` as lines, for the caller to quote
 * when a file it expected is not there.
 *
 * The CLI exits 0 even when an export threw: it prints the exception to
 * stderr, appends it to ./exceptions.txt and moves on. So a missing file is
 * often the only sign, and that stderr the only explanation. Both streams go
 * to files rather than pipes -- stdout is a line per written file, and
 * rush_001's entities folder alone overflows execFileSync's buffer (ENOBUFS)
 * -- and only their ends are read back. The cwd is scratch because that
 * exceptions.txt would otherwise pile up in the image's WORKDIR, and a
 * read-only one turns the CLI's own logging into an unhandled crash.
 */
export function decompile(cli, vpk, filepath, out, extra = []) {
  const scratch = mkdtempSync(join(tmpdir(), "s2v-"));
  try {
    const stdoutPath = join(scratch, "stdout.log");
    const stderrPath = join(scratch, "stderr.log");
    const stdoutFd = openSync(stdoutPath, "w");
    const stderrFd = openSync(stderrPath, "w");
    let failure = null;
    try {
      execFileSync(
        cli.includes("/") ? resolve(cli) : cli,
        ["-i", resolve(vpk), "--vpk_filepath", filepath, "-o", resolve(out), "-d", ...extra],
        { cwd: scratch, stdio: ["ignore", stdoutFd, stderrFd] },
      );
    } catch (error) {
      failure = error.status != null ? `exit ${error.status}` : (error.signal ?? error.code);
    } finally {
      closeSync(stdoutFd);
      closeSync(stderrFd);
    }

    const run = {
      stderr: tailLines(readTail(stderrPath), STDERR_LINES),
      stdout: tailLines(readTail(stdoutPath), STDOUT_LINES),
    };
    if (failure) {
      const said = describeOutput(run);
      throw new Error(
        `Source2Viewer-CLI failed on ${filepath} (${failure})${said ? `: ${said}` : ""}`,
      );
    }
    return run;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
