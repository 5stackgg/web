import { createCalloutsModule } from "./callouts";
import { createCameraModule } from "./camera";
import { createCombatModule } from "./combat";
import { createFireModule } from "./fire";
import { createGrenadesModule } from "./grenades";
import { createGroundItemsModule } from "./groundItems";
import { createMapModule } from "./map";
import { createPlayersModule } from "./players";
import { createSmokeModule } from "./smoke";
import { createTrailsModule } from "./trails";
import { createUtilityOverlayModule } from "./utilityOverlay";

/** Every module the stage runs, in update order. */
export function createStageModules() {
  const camera = createCameraModule();
  const map = createMapModule();
  const utility = createUtilityOverlayModule();
  const ground = createGroundItemsModule();
  return {
    camera,
    map,
    utility,
    ground,
    modules: [
      camera,
      map,
      createCalloutsModule(),
      createTrailsModule(),
      createFireModule(),
      createSmokeModule(),
      createGrenadesModule(),
      utility,
      ground,
      createPlayersModule(),
      createCombatModule(),
    ],
  };
}
