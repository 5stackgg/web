// Kept out of the SFC because `<script setup>` cannot carry ES exports.
export type TournamentCardVariant = "feature" | "compact" | "simple";

export type TournamentStatusVariant =
  | "default"
  | "finished"
  | "live"
  | "registration";
