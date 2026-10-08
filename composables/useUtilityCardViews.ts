import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

/**
 * The two layers of the utility card that views draw into: one for what a tab
 * opens over its own list, one above it for what can open over any tab -- and
 * the stage, the map's own square, for a view with something bigger to show
 * than the card has room for (an execute thrown in 3D). While something is on
 * the stage, `staged` says so, and the map's own controls step aside.
 *
 * Handed down as elements rather than looked up by selector. The page mounts
 * inside a suspended, transitioning route, where its DOM is not in the
 * document yet at the moment a teleport would go looking for a selector --
 * and a teleport that misses its target on mount never draws at all.
 */
type UtilityCardViewLayers = {
  base: Ref<HTMLElement | null>;
  top: Ref<HTMLElement | null>;
  stage: Ref<HTMLElement | null>;
  staged: Ref<boolean>;
};

const KEY: InjectionKey<UtilityCardViewLayers> = Symbol("utility-card-views");

export function provideUtilityCardViews(): UtilityCardViewLayers {
  const layers = {
    base: ref<HTMLElement | null>(null),
    top: ref<HTMLElement | null>(null),
    stage: ref<HTMLElement | null>(null),
    staged: ref(false),
  };
  provide(KEY, layers);
  return layers;
}

export function useUtilityCardViews(): UtilityCardViewLayers | null {
  return inject(KEY, null);
}
