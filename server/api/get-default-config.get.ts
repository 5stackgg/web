// The shipped cfg files, by the type that names them. Global has no shipped
// default -- it is the operator's own layer, empty until they write one -- and
// the rest are looked up rather than interpolated so a crafted type cannot
// reach anywhere else in the raw.githubusercontent path space.
const DEFAULT_CONFIGS: Record<string, string | null> = {
  lan: "5stack.lan.cfg",
  competitive: "5stack.competitive.cfg",
  wingman: "5stack.wingman.cfg",
  duel: "5stack.duel.cfg",
  global: null,
};

export default defineCachedEventHandler(
  async (event) => {
    try {
      const type = getQuery(event).type?.toString().trim().toLowerCase();

      if (!type) {
        throw new Error("type is required");
      }

      if (!Object.hasOwn(DEFAULT_CONFIGS, type)) {
        throw new Error(`unknown config type: ${type}`);
      }

      const file = DEFAULT_CONFIGS[type];

      if (!file) {
        return "";
      }

      const response = await fetch(
        `https://raw.githubusercontent.com/5stackgg/game-server/refs/heads/main/shared/cfg/${file}`,
      );

      if (!response.ok) {
        throw new Error(
          `unable to fetch config for ${type}: ${response.status}`,
        );
      }

      return await response.text();
    } catch (error) {
      console.error("unable to get config:", error);
    }
  },
  { maxAge: 60 * 60 },
);
