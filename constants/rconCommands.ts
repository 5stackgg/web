import { e_match_map_status_enum } from "~/generated/zeus";

export enum RconAction {
  Pause = "pause",
  Resume = "resume",
  SkipKnife = "skip_knife",
  ForceReady = "force_ready",
  ResetToKnife = "match_state Knife",
  ResetToWarmup = "match_state Warmup",
}

export const DEFAULT_PLUGIN_RUNTIME = "swiftlys2";

const RUNTIME_COMMANDS: Record<string, Partial<Record<RconAction, string>>> = {
  counterstrikesharp: {
    [RconAction.Pause]: "css_pause",
    [RconAction.Resume]: "css_resume",
  },
  swiftlys2: {
    [RconAction.Pause]: "sw_pause",
    [RconAction.Resume]: "sw_resume",
  },
};

export function resolveRconCommand(
  action: RconAction,
  pluginRuntime?: string | null,
): string {
  const runtime = pluginRuntime || DEFAULT_PLUGIN_RUNTIME;
  return RUNTIME_COMMANDS[runtime]?.[action] ?? action;
}

export function effectivePluginRuntime(
  serverPluginRuntime?: string | null,
  globalPluginRuntime?: string | null,
): string {
  return serverPluginRuntime || globalPluginRuntime || DEFAULT_PLUGIN_RUNTIME;
}

export type QuickCommand = {
  command: string | Array<string>;
  display: string;
  logsOnly?: boolean;
};

const RUNTIME_QUICK_COMMANDS: Record<string, QuickCommand[]> = {
  counterstrikesharp: [
    {
      command: "fivestack_status",
      display: "server.rcon.fivestack_status",
    },
    {
      command: "meta version",
      display: "server.rcon.metamod_info",
    },
    {
      command: "css",
      display: "server.rcon.css_version",
    },
    {
      command: "css_plugins list",
      display: "server.rcon.css_info",
    },
  ],
  swiftlys2: [
    {
      command: "fivestack_status",
      display: "server.rcon.fivestack_status",
    },
    {
      command: "buildinfo",
      display: "server.rcon.swiftly_version",
    },
    // SwiftlyS2 routes `sw` output to its own log sink rather than the engine
    // console, so RCON gets an empty body back even though the command ran.
    {
      command: "sw status",
      display: "server.rcon.swiftly_status",
      logsOnly: true,
    },
    {
      command: "sw plugins list",
      display: "server.rcon.swiftly_plugins",
      logsOnly: true,
    },
  ],
};

export function quickCommandsForRuntime(
  pluginRuntime?: string | null,
): QuickCommand[] {
  return RUNTIME_QUICK_COMMANDS[pluginRuntime || DEFAULT_PLUGIN_RUNTIME] ?? [];
}

const LOGS_ONLY_COMMANDS = new Set(
  Object.values(RUNTIME_QUICK_COMMANDS)
    .flat()
    .filter((quickCommand) => quickCommand.logsOnly)
    .flatMap((quickCommand) =>
      Array.isArray(quickCommand.command)
        ? quickCommand.command
        : [quickCommand.command],
    ),
);

export function isLogsOnlyCommand(command: string): boolean {
  return LOGS_ONLY_COMMANDS.has(command.trim());
}

export type MatchCommand = {
  action: RconAction;
  display: string;
  confirm?: boolean;
};

const MATCH_COMMANDS: Record<RconAction, MatchCommand> = {
  [RconAction.Pause]: {
    action: RconAction.Pause,
    display: "match.commands.pause_match",
  },
  [RconAction.Resume]: {
    action: RconAction.Resume,
    display: "match.commands.resume_match",
  },
  [RconAction.SkipKnife]: {
    action: RconAction.SkipKnife,
    display: "match.commands.skip_knife",
  },
  [RconAction.ForceReady]: {
    action: RconAction.ForceReady,
    display: "match.commands.force_ready",
  },
  [RconAction.ResetToKnife]: {
    action: RconAction.ResetToKnife,
    display: "match.commands.reset_to_knife",
    confirm: true,
  },
  [RconAction.ResetToWarmup]: {
    action: RconAction.ResetToWarmup,
    display: "match.commands.reset_to_warmup",
    confirm: true,
  },
};

export function matchCommandsForStatus(status?: string | null): MatchCommand[] {
  switch (status) {
    case e_match_map_status_enum.Warmup:
    case e_match_map_status_enum.Scheduled:
      return [MATCH_COMMANDS[RconAction.ForceReady]];
    case e_match_map_status_enum.Knife:
      return [
        MATCH_COMMANDS[RconAction.SkipKnife],
        MATCH_COMMANDS[RconAction.ResetToWarmup],
      ];
    case e_match_map_status_enum.Paused:
      return [
        MATCH_COMMANDS[RconAction.Resume],
        MATCH_COMMANDS[RconAction.ResetToWarmup],
        MATCH_COMMANDS[RconAction.ResetToKnife],
      ];
    case e_match_map_status_enum.Live:
    case e_match_map_status_enum.Overtime:
      return [MATCH_COMMANDS[RconAction.Pause]];
    default:
      return [];
  }
}
