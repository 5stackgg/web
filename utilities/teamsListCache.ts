// What the Teams page last showed, kept for the session. Coming back to the
// page renders it at once while fresh data loads, instead of empty sections
// filling in and shoving the page around. Module state, so it outlives the
// components that read it.

// The viewer's own teams, by steam id.
export const lastYourTeams = new Map<string, any[]>();

// Directory results, by the query that produced them.
export const lastDirectoryResults = new Map<
  string,
  { teams: any[]; total: number }
>();

// Rows on the last directory page shown, to size its loading skeleton.
export const lastDirectoryRowCount = { value: 0 };
