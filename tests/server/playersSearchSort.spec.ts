import { describe, expect, it } from "vitest";
import { playersSearchSortBy } from "~/server/utils/playersSearchSort";

describe("playersSearchSortBy", () => {
  it("sorts role on the numeric rank with a name tiebreak", () => {
    expect(playersSearchSortBy("role", "desc", "elo")).toBe(
      "role_rank(missing_values: last):desc,name:asc",
    );
    expect(playersSearchSortBy("role", "asc", "elo")).toBe(
      "role_rank(missing_values: last):asc,name:asc",
    );
  });

  it("sorts elo on the chosen ladder with unrated players last", () => {
    expect(playersSearchSortBy("elo", "desc", "elo")).toBe(
      "elo(missing_values: last):desc,name:asc",
    );
    expect(playersSearchSortBy("elo", "asc", "tournament_elo")).toBe(
      "tournament_elo(missing_values: last):asc,name:asc",
    );
  });

  it("passes other fields straight through", () => {
    expect(playersSearchSortBy("name", "asc", "elo")).toBe("name:asc");
    expect(playersSearchSortBy("last_sign_in_at", "desc", "elo")).toBe(
      "last_sign_in_at:desc",
    );
  });
});
