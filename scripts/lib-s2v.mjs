// Source2Viewer-CLI plumbing shared by the map extractors.
//
// The CLI is a self-contained ValveResourceFormat build, fetched once into
// `.cache/s2v/` unless CLI names one already on disk -- which is how these run
// in-cluster, where the inventory plugin's model extraction has already put one
// at /cs2-models/.work/cs2-model-extract/cli/Source2Viewer-CLI.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cliDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".cache", "s2v");

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

/**
 * Decompile one VPK entry, or a whole folder if the path ends in a slash.
 * `extra` carries export flags such as --gltf_export_format.
 */
export function decompile(cli, vpk, filepath, out, extra = []) {
  execFileSync(cli, ["-i", vpk, "--vpk_filepath", filepath, "-o", out, "-d", ...extra], {
    stdio: "pipe",
  });
}
