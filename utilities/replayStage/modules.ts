import { createBlastModule } from "./blast";
import { createCalloutsModule } from "./callouts";
import { createCameraModule } from "./camera";
import { createCombatModule } from "./combat";
import { createFireModule } from "./fire";
import { createGrenadesModule } from "./grenades";
import { createGroundItemsModule } from "./groundItems";
import { createMapModule } from "./map";
import { createOverlayRoundsModule } from "./overlayRounds";
import { createPlayersModule } from "./players";
import { createSmokeModule } from "./smoke";
import { createTrailsModule } from "./trails";
import { createUtilityOverlayModule } from "./utilityOverlay";
import { createVisionModule } from "./vision";

/** Every module the stage runs, in update order. */
export function createStageModules() {
  const camera = createCameraModule();
  const map = createMapModule();
  const utility = createUtilityOverlayModule();
  const ground = createGroundItemsModule();
  const smoke = createSmokeModule();
  const vision = createVisionModule(smoke);
  const blast = createBlastModule();
  smoke.setBlastSource((frame) => blast.smokeBlasts(frame));
  return {
    camera,
    map,
    utility,
    ground,
    vision,
    blast,
    modules: [
      camera,
      map,
      createCalloutsModule(),
      createTrailsModule(),
      createFireModule(),
      smoke,
      vision,
      createGrenadesModule(),
      blast,
      utility,
      ground,
      createOverlayRoundsModule(),
      createPlayersModule(),
      createCombatModule(),
    ],
  };
}
