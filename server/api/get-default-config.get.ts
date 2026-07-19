export default defineCachedEventHandler(
  async (event) => {
    try {
      let type = getQuery(event).type?.trim().toLowerCase();

      if (!type) {
        throw new Error("type is required");
      }

      const response = await fetch(
        `https://raw.githubusercontent.com/5stackgg/game-server/refs/heads/main/shared/cfg/5stack.${type}.cfg`,
      );

      if (!response.ok) {
        throw new Error(`unable to fetch config for ${type}: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error("unable to get config:", error);
    }
  },
  { maxAge: 60 * 60 },
);
