#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webRoot, "..");

const defaultConfigPath = path.join(repoRoot, "docs/screenshots.config.mjs");
const defaultOutputDir = path.join(repoRoot, "docs/public/screenshots");
const defaultMarkdownPath = path.join(repoRoot, "docs/screenshots.md");
const defaultBaseUrl = "https://5stack.gg";
const authProfiles = new Set(["user", "admin"]);
const profileNames = new Set(["guest", ...authProfiles]);
const profileOrder = ["guest", "user", "admin"];

function storageStatePathForBaseUrl(baseUrl, profile) {
  const url = new URL(baseUrl);
  const host = url.host.replace(/[^a-z0-9.-]+/gi, "-");
  return path.join(webRoot, `.auth/docs-screenshots.${profile}.${host}.json`);
}

function profileDirForBaseUrl(baseUrl, profile) {
  const url = new URL(baseUrl);
  const host = url.host.replace(/[^a-z0-9.-]+/gi, "-");
  return path.join(webRoot, `.auth/docs-screenshots-profile.${profile}.${host}`);
}

function normalizeBaseUrl(baseUrl) {
  if (/^https?:\/\//i.test(baseUrl)) {
    return new URL(baseUrl).toString();
  }

  return new URL(`https://${baseUrl}`).toString();
}

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.SCREENSHOT_BASE_URL || defaultBaseUrl,
    authPath: process.env.SCREENSHOT_AUTH_PATH || "/play",
    authProfile: process.env.SCREENSHOT_AUTH_PROFILE || "admin",
    config: defaultConfigPath,
    outputDir: defaultOutputDir,
    markdownPath: defaultMarkdownPath,
    storageState: process.env.SCREENSHOT_STORAGE_STATE,
    profileDir: process.env.SCREENSHOT_PROFILE_DIR,
    useProfile: false,
    autoAuth: process.env.SCREENSHOT_AUTO_AUTH !== "false",
    headed: false,
    saveAuth: false,
    updateMarkdown: true,
    list: false,
    only: [],
    dryRun: false,
    slowMo: Number(process.env.SCREENSHOT_SLOW_MO || 0),
    pauseOnFailure: false,
    timeout: Number(process.env.SCREENSHOT_TIMEOUT || 30000),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      return argv[i];
    };

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--base-url") {
      args.baseUrl = next();
    } else if (arg === "--auth-path") {
      args.authPath = next();
    } else if (arg === "--auth-profile") {
      args.authProfile = next();
    } else if (arg === "--config") {
      args.config = path.resolve(next());
    } else if (arg === "--out-dir") {
      args.outputDir = path.resolve(next());
    } else if (arg === "--markdown") {
      args.markdownPath = path.resolve(next());
    } else if (arg === "--storage-state") {
      args.storageState = path.resolve(next());
    } else if (arg === "--profile-dir") {
      args.profileDir = path.resolve(next());
    } else if (arg === "--use-profile") {
      args.useProfile = true;
    } else if (arg === "--no-auto-auth") {
      args.autoAuth = false;
    } else if (arg === "--only") {
      args.only.push(...next().split(",").map((item) => item.trim()));
    } else if (arg === "--timeout") {
      args.timeout = Number(next());
    } else if (arg === "--slow-mo") {
      args.slowMo = Number(next());
    } else if (arg === "--headed") {
      args.headed = true;
    } else if (arg === "--pause-on-failure") {
      args.pauseOnFailure = true;
      args.headed = true;
    } else if (arg === "--save-auth") {
      args.saveAuth = true;
      args.headed = true;
    } else if (arg === "--no-update-md") {
      args.updateMarkdown = false;
    } else if (arg === "--list") {
      args.list = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.timeout) || args.timeout <= 0) {
    throw new Error("--timeout must be a positive number");
  }

  if (!Number.isFinite(args.slowMo) || args.slowMo < 0) {
    throw new Error("--slow-mo must be a positive number");
  }

  if (!authProfiles.has(args.authProfile)) {
    throw new Error("--auth-profile must be user or admin");
  }

  args.baseUrl = normalizeBaseUrl(args.baseUrl);
  args.storageState = path.resolve(
    args.storageState ||
      storageStatePathForBaseUrl(args.baseUrl, args.authProfile),
  );
  args.profileDir = path.resolve(
    args.profileDir || profileDirForBaseUrl(args.baseUrl, args.authProfile),
  );

  return args;
}

function printHelp() {
  console.log(`
Capture docs screenshots from a running 5Stack web app.

Usage:
  yarn screenshots
  yarn screenshots:headed --only Play
  yarn screenshots:auth:user
  yarn screenshots:auth:admin

Options:
  --base-url <url>          App URL to capture. Default: SCREENSHOT_BASE_URL or https://5stack.gg
  --auth-path <path>        Path opened by --save-auth. Default: SCREENSHOT_AUTH_PATH or /play
  --auth-profile <name>     Profile saved by --save-auth. One of: user, admin
  --save-auth               Open a headed browser, let you log in, then save storage state
  --storage-state <file>    Auth storage file for --auth-profile
  --use-profile             Reuse a persistent browser profile instead of storage-state only
  --profile-dir <dir>       Persistent profile dir for --auth-profile
  --no-auto-auth            Do not prompt for missing/expired user/admin profiles
  --only <names>            Comma-separated title/file filter, e.g. "Play,Teams"
  --headed                  Show the browser while capturing
  --slow-mo <ms>            Slow Playwright actions so you can watch them. Default: 0
  --pause-on-failure        Keep the failed browser page open until you press Enter
  --no-update-md            Do not regenerate docs/screenshots.md
  --list                    List configured screenshots
  --dry-run                 List what would be captured without opening a browser
  --timeout <ms>            Per-action timeout. Default: 30000
`);
}

async function loadModule(packageName, installHint) {
  try {
    return await import(packageName);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(`Missing ${packageName}. ${installHint}`);
    }
    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mergeShot(defaults, shot) {
  const profile = shot.profile || (shot.auth ? "admin" : "guest");

  if (!profileNames.has(profile)) {
    throw new Error(
      `Invalid screenshot profile "${profile}" for "${shot.title}". Use guest, user, or admin.`,
    );
  }

  return {
    ...defaults,
    ...shot,
    profile,
    viewport: {
      ...(defaults.viewport || {}),
      ...(shot.viewport || {}),
    },
    localStorage: {
      ...(defaults.localStorage || {}),
      ...(shot.localStorage || {}),
    },
    actions: [...(defaults.actions || []), ...(shot.actions || [])],
  };
}

function profileRequiresAuth(profile) {
  return authProfiles.has(profile);
}

function storageStatePathForProfile(args, profile) {
  if (profile === args.authProfile && args.storageState) {
    return args.storageState;
  }

  return path.resolve(storageStatePathForBaseUrl(args.baseUrl, profile));
}

function profileDirForProfile(args, profile) {
  if (profile === args.authProfile && args.profileDir) {
    return args.profileDir;
  }

  return path.resolve(profileDirForBaseUrl(args.baseUrl, profile));
}

function toAbsoluteUrl(baseUrl, shot) {
  if (shot.url) {
    return shot.url;
  }

  return new URL(shot.path || "/", baseUrl).toString();
}

function normalizeFilter(value) {
  return value.toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/\s+/g, "");
}

function filterScreenshots(screenshots, only) {
  if (only.length === 0) {
    return screenshots;
  }

  const filters = only.map(normalizeFilter);
  return screenshots.filter((shot) => {
    const title = normalizeFilter(shot.title);
    const file = normalizeFilter(shot.file);
    return filters.some((filter) => {
      if (title === filter || file === filter) {
        return true;
      }

      return (
        filter.length >= 5 && (title.includes(filter) || file.includes(filter))
      );
    });
  });
}

function orderScreenshotsForCapture(screenshots) {
  return screenshots
    .map((shot, index) => ({ shot, index }))
    .sort((a, b) => {
      const profileDiff =
        profileOrder.indexOf(a.shot.profile) -
        profileOrder.indexOf(b.shot.profile);

      return profileDiff || a.index - b.index;
    })
    .map(({ shot }) => shot);
}

function renderMarkdown(screenshots) {
  const imageLines = screenshots
    .map((shot) => `    '/screenshots/${shot.file}',`)
    .join("\n");
  const captionLines = screenshots
    .map((shot) => `    '${shot.title.replace(/'/g, "\\'")}',`)
    .join("\n");

  return `<!-- Generated by \`yarn screenshots\` from \`docs/screenshots.config.mjs\`. -->\n\n<Gallery \n  :images="[\n${imageLines}\n  ]"\n  :captions="[\n${captionLines}\n  ]"\n/>\n`;
}

async function updateMarkdown(markdownPath, screenshots) {
  await fs.writeFile(markdownPath, renderMarkdown(screenshots));
  console.log(`Updated ${path.relative(repoRoot, markdownPath)}`);
}

async function waitForEnter(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await rl.question(message);
  rl.close();
}

async function saveStorageState(context, storageStatePath) {
  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  try {
    await context.storageState({ path: storageStatePath, indexedDB: true });
  } catch {
    await context.storageState({ path: storageStatePath });
  }
}

async function saveAuthState({ chromium }, args, defaults, profile = args.authProfile) {
  const storageStatePath = storageStatePathForProfile(args, profile);
  const profileDir = profileDirForProfile(args, profile);

  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  let browser;
  let context;

  if (args.useProfile) {
    await fs.mkdir(profileDir, { recursive: true });
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      slowMo: args.slowMo,
      viewport: defaults.viewport || { width: 1440, height: 960 },
      colorScheme: defaults.colorScheme || "dark",
      reducedMotion: "reduce",
    });
  } else {
    browser = await chromium.launch({
      headless: false,
      slowMo: args.slowMo,
    });
    context = await browser.newContext({
      viewport: defaults.viewport || { width: 1440, height: 960 },
      colorScheme: defaults.colorScheme || "dark",
    });
  }

  const page = await context.newPage();
  await page.goto(new URL(args.authPath, args.baseUrl).toString(), {
    waitUntil: "domcontentloaded",
  });

  console.log(
    `Log in as ${profile} at ${new URL(args.authPath, args.baseUrl).toString()} in the opened browser.`,
  );
  await waitForEnter("Press Enter here after the session looks ready...");

  await saveStorageState(context, storageStatePath);
  await context.close();
  await browser?.close();

  console.log(`Saved auth state to ${path.relative(repoRoot, storageStatePath)}`);
  if (args.useProfile) {
    console.log(`Saved browser profile to ${path.relative(repoRoot, profileDir)}`);
  }
}

async function isProfileReady({ chromium }, args, defaults, profile) {
  const profileDir = profileDirForProfile(args, profile);

  if (!(await pathExists(profileDir))) {
    return false;
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: defaults.viewport || { width: 1440, height: 960 },
    colorScheme: defaults.colorScheme || "dark",
    reducedMotion: "reduce",
  });

  const page = await context.newPage();

  try {
    await page.goto(new URL(args.authPath, args.baseUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: args.timeout,
    });
    await page.waitForTimeout(2500);
    return new URL(page.url()).pathname !== "/login";
  } catch {
    return false;
  } finally {
    await context.close();
  }
}

async function ensureAuthProfiles(playwright, args, defaults, profiles) {
  if (!args.useProfile || !args.autoAuth) {
    return;
  }

  for (const profile of profiles) {
    if (await isProfileReady(playwright, args, defaults, profile)) {
      continue;
    }

    console.log(
      `The ${profile} screenshot profile needs login before captures can continue.`,
    );
    await saveAuthState(playwright, args, defaults, profile);
  }
}

async function ensureAuthProfile(playwright, args, defaults, profile) {
  await ensureAuthProfiles(playwright, args, defaults, [profile]);
}

async function applyLocalStorage(page, localStorageItems) {
  const entries = Object.entries(localStorageItems || {});
  if (entries.length === 0) {
    return;
  }

  await page.addInitScript((items) => {
    for (const [key, value] of items) {
      if (value === null || value === undefined) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, String(value));
      }
    }
  }, entries);
}

async function syncLeftSidebar(page, desiredState, timeout) {
  if (!desiredState || desiredState === "auto") {
    return;
  }

  if (!["collapsed", "expanded"].includes(desiredState)) {
    throw new Error(
      `leftSidebar must be "collapsed", "expanded", or "auto"; got "${desiredState}"`,
    );
  }

  const sidebar = page.locator('[data-side="left"][data-state]').first();
  await sidebar.waitFor({
    state: "attached",
    timeout: Math.min(timeout, 5000),
  });

  const currentState = await sidebar.getAttribute("data-state");
  if (currentState === desiredState) {
    return;
  }

  await page.locator('[data-sidebar="trigger"]').first().click({ timeout });
  await page
    .locator(`[data-side="left"][data-state="${desiredState}"]`)
    .first()
    .waitFor({
      state: "attached",
      timeout: Math.min(timeout, 5000),
    });
  await page.waitForTimeout(250);
}

async function runAction(page, action, timeout) {
  const optional = Boolean(action.optional);

  try {
    if (action.click) {
      await page.locator(action.click).first().click({ timeout });
    } else if (action.clickText) {
      await page.getByText(action.clickText, { exact: false }).first().click({ timeout });
    } else if (action.fill) {
      await page.locator(action.fill).first().fill(action.value || "", { timeout });
    } else if (action.press) {
      await page.keyboard.press(action.press);
    } else if (action.hover) {
      await page.locator(action.hover).first().hover({ timeout });
    } else if (action.waitForSelector) {
      await page.locator(action.waitForSelector).first().waitFor({
        state: action.state || "visible",
        timeout,
      });
    } else if (action.waitForTimeout) {
      await page.waitForTimeout(Number(action.waitForTimeout));
    } else {
      throw new Error(`Unknown action: ${JSON.stringify(action)}`);
    }
  } catch (error) {
    if (!optional) {
      throw error;
    }
  }
}

async function settlePage(page, shot, timeout) {
  await page
    .locator(".pre-loader")
    .first()
    .waitFor({ state: "detached", timeout: Math.min(timeout, 5000) })
    .catch(() => {});

  if (shot.waitForSelector) {
    await page.locator(shot.waitForSelector).first().waitFor({
      state: "visible",
      timeout,
    });
  }

  await syncLeftSidebar(page, shot.leftSidebar, timeout);

  for (const action of shot.actions || []) {
    await runAction(page, action, timeout);
  }

  if (shot.waitForTimeout) {
    await page.waitForTimeout(Number(shot.waitForTimeout));
  }
}

async function screenshotBuffer(page, shot, timeout) {
  const screenshotOptions = {
    animations: "disabled",
    caret: "hide",
    scale: "css",
  };

  if (shot.clip) {
    return page.screenshot({
      ...screenshotOptions,
      clip: shot.clip,
    });
  }

  if (shot.selector) {
    let locator = page.locator(shot.selector).first();

    try {
      await locator.waitFor({
        state: "visible",
        timeout: Math.min(timeout, 3000),
      });
    } catch (error) {
      if (shot.selector !== "[data-screenshot-root]") {
        throw error;
      }

      console.warn(
        "  [data-screenshot-root] was not found; falling back to body. Deploy the app change for cleaner crops.",
      );
      locator = page.locator("body").first();
      await locator.waitFor({ state: "visible", timeout });
    }

    return locator.screenshot(screenshotOptions);
  }

  return page.screenshot({
    ...screenshotOptions,
    fullPage: Boolean(shot.fullPage),
  });
}

async function captureShot({ browser, persistentContext, sharp, args, shot }) {
  const storageStatePath = storageStatePathForProfile(args, shot.profile);
  const storageStateExists = await pathExists(storageStatePath);

  if (
    profileRequiresAuth(shot.profile) &&
    !args.useProfile &&
    !storageStateExists
  ) {
    throw new Error(
      `Screenshot "${shot.title}" requires ${shot.profile} auth. Run \`yarn screenshots:auth:${shot.profile} --base-url ${args.baseUrl}\` first.`,
    );
  }

  const context =
    persistentContext ||
    (await browser.newContext({
      storageState: profileRequiresAuth(shot.profile)
        ? storageStatePath
        : undefined,
      viewport: shot.viewport,
      colorScheme: shot.colorScheme || "dark",
      deviceScaleFactor: shot.deviceScaleFactor || 1,
      reducedMotion: "reduce",
    }));

  const page = await context.newPage();
  page.setDefaultTimeout(args.timeout);
  if (shot.viewport) {
    await page.setViewportSize(shot.viewport);
  }

  try {
    await applyLocalStorage(page, shot.localStorage);

    const url = toAbsoluteUrl(args.baseUrl, shot);
    await page.goto(url, { waitUntil: shot.waitUntil || "domcontentloaded" });

    if (profileRequiresAuth(shot.profile)) {
      await page.waitForTimeout(500);
      if (new URL(page.url()).pathname === "/login") {
        throw new Error(
          `Screenshot "${shot.title}" redirected to login. Refresh ${shot.profile} auth with \`yarn screenshots:auth:${shot.profile} --base-url ${args.baseUrl}\`.`,
        );
      }
    }

    await settlePage(page, shot, args.timeout);

    const buffer = await screenshotBuffer(page, shot, args.timeout);
    const outputPath = path.join(args.outputDir, shot.file);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await sharp(buffer)
      .webp({ quality: Number(shot.quality || 88) })
      .toFile(outputPath);

    await page.close();
    if (!persistentContext) {
      await context.close();
    }
    return outputPath;
  } catch (error) {
    const title = await page.title().catch(() => "");
    const bodyText = await page
      .locator("body")
      .innerText({ timeout: 1000 })
      .catch(() => "");
    const bodyPreview = bodyText.replace(/\s+/g, " ").trim().slice(0, 300);

    console.error(`  URL: ${page.url()}`);
    if (title) {
      console.error(`  Title: ${title}`);
    }
    if (bodyPreview) {
      console.error(`  Body: ${bodyPreview}`);
    }

    if (args.pauseOnFailure) {
      await waitForEnter(
        "Browser is paused on the failed page. Press Enter to close it and continue...",
      );
    }

    await page.close().catch(() => {});
    if (!persistentContext) {
      await context.close();
    }
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const configUrl = `${pathToFileURL(args.config).href}?t=${Date.now()}`;
  const config = await import(configUrl);
  const defaults = config.defaults || {};
  const screenshots = orderScreenshotsForCapture(
    filterScreenshots(
      (config.screenshots || []).map((shot) => mergeShot(defaults, shot)),
      args.only,
    ),
  );

  if (screenshots.length === 0) {
    throw new Error("No screenshots matched the requested filters.");
  }

  if (args.list || args.dryRun) {
    for (const shot of screenshots) {
      const authLabel =
        shot.profile === "guest" ? " [guest]" : ` [${shot.profile}]`;
      console.log(
        `${shot.title}${authLabel}: ${toAbsoluteUrl(args.baseUrl, shot)} -> ${shot.file}`,
      );
    }
    if (args.dryRun) {
      return;
    }
  }

  const playwright = await loadModule(
    "playwright",
    "Run `yarn add -D playwright` and `yarn playwright install chromium` from web/.",
  );

  if (args.saveAuth) {
    await saveAuthState(playwright, args, defaults);
    return;
  }

  const sharpModule = await loadModule(
    "sharp",
    "Run `yarn add -D sharp` from web/.",
  );
  const sharp = sharpModule.default || sharpModule;

  if (args.updateMarkdown) {
    await updateMarkdown(args.markdownPath, screenshots);
  }

  const persistentContexts = new Map();
  let browser;

  async function getPersistentContext(profile) {
    if (!args.useProfile || !profileRequiresAuth(profile)) {
      return undefined;
    }

    if (persistentContexts.has(profile)) {
      return persistentContexts.get(profile);
    }

    const context = await playwright.chromium.launchPersistentContext(
      profileDirForProfile(args, profile),
      {
        headless: !args.headed,
        slowMo: args.slowMo,
        viewport: defaults.viewport || { width: 1440, height: 960 },
        colorScheme: defaults.colorScheme || "dark",
        reducedMotion: "reduce",
      },
    );

    persistentContexts.set(profile, context);
    return context;
  }

  async function getBrowser() {
    if (browser) {
      return browser;
    }

    browser = await playwright.chromium.launch({
      headless: !args.headed,
      slowMo: args.slowMo,
    });
    return browser;
  }

  const failures = [];
  const checkedProfiles = new Set();

  async function ensureProfileForShot(shot) {
    if (!profileRequiresAuth(shot.profile) || checkedProfiles.has(shot.profile)) {
      return;
    }

    if (args.useProfile) {
      await ensureAuthProfile(playwright, args, defaults, shot.profile);

      if (!(await pathExists(profileDirForProfile(args, shot.profile)))) {
        throw new Error(
          `Screenshots require the ${shot.profile} profile. Run \`yarn screenshots:auth:${shot.profile} --base-url ${args.baseUrl}\` first, or rerun without --no-auto-auth.`,
        );
      }
    } else if (!(await pathExists(storageStatePathForProfile(args, shot.profile)))) {
      throw new Error(
        `Screenshots require ${shot.profile} auth. Run \`yarn screenshots:auth:${shot.profile} --base-url ${args.baseUrl}\` first.`,
      );
    }

    checkedProfiles.add(shot.profile);
  }

  for (const shot of screenshots) {
    try {
      await ensureProfileForShot(shot);
      const persistentContext = await getPersistentContext(shot.profile);
      const outputPath = await captureShot({
        browser: persistentContext ? undefined : await getBrowser(),
        persistentContext,
        sharp,
        args,
        shot,
      });
      console.log(`Captured ${shot.title} -> ${path.relative(repoRoot, outputPath)}`);
    } catch (error) {
      failures.push({ shot, error });
      console.error(`Failed ${shot.title}: ${error.message}`);
    }
  }

  for (const context of persistentContexts.values()) {
    await context.close();
  }
  await browser?.close();

  if (failures.length > 0) {
    console.error(`\n${failures.length} screenshot(s) failed.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
