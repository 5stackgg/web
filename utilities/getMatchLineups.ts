export default function getMatchLineups(match) {
  return {
    lineup1: match?.lineups.find((lineup) => {
      return lineup.id === match.lineup_1_id;
    }),
    lineup2: match?.lineups.find((lineup) => {
      return lineup.id === match.lineup_2_id;
    }),
  };
}
