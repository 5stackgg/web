<template>
  <!-- The drift tools are still the utility feature, so this is the same HE
       artwork with a thrown-arc sweeping into it. Two elements rather than one
       inline SVG: the grenade is the shared masked artwork, the arc is drawn
       over it. The arc is solid and the grenade stays large on purpose — a
       dashed trail or a second landing marker turns to mush at the 16px the
       sidebar renders this at. -->
  <span aria-hidden="true" class="relative inline-block shrink-0">
    <span
      class="he-grenade-mask absolute left-[45%] top-[2.5%] h-[69.3%] w-[52.5%] bg-current"
    />
    <svg
      class="absolute inset-0 h-full w-full"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    >
      <path d="M1.2 15C1.7 12 3.4 10.2 6.6 9.4" />
    </svg>
  </span>
</template>
