/**
 * Format versions of the replay stage's published map files that this build
 * reads. Their own module, so mapAssets can skip a file of another version
 * by its key (`<map>.prep.v2.bin.gz`) without loading the stage.
 */

/** Bump whenever prep's output changes (mapPrepPack.ts). */
export const PREP_VERSION = 2;

/** 1: the browser's own fields; 2: Valve's baked damage (blastField.ts). */
export const BLAST_FILE_VERSIONS = [1, 2];
