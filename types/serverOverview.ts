export type ServerRosterStatus = {
  count: number;
  live: boolean;
  community: boolean;
  pluginActive: boolean;
  pluginVersion: string | null;
  pluginRuntime: string | null;
  pluginSeenAt: string | null;
};

export type ServerRecentTotals = {
  day: number;
  week: number;
  sessions: number;
  seconds: number;
};
