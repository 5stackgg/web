<!--
  "This goes to the server you are standing on."

  Every control that pushes a throw into a live practice server carries this,
  so the difference between "start a server" (a rocket) and "put this on the
  one I am already in" is visible before the tooltip is read.

  One <svg>, not two lucide icons in a wrapper: a button variant's
  `[&_svg]:size-4` is a descendant rule, so it would size the badge to match
  the base glyph and the pair would print on top of each other. Template only
  and a single root, the way UtilityMetaIcon does it, so `class` falls through
  from the call site and this sizes like any other icon.

  The rack is dropped and its top unit stops short of the right-hand corner
  rather than closing it: at 16px a stroke crossing a stroke rasterises to one
  thick smudge, so the arrow is given an empty corner to leave through instead.
-->
<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12 4H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2" />
    <path d="M6 8h.01" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <path d="M6 18h.01" />
    <!-- lucide's external-link arrow, at the size that survives the raster. -->
    <path d="M15 9 22 2" />
    <path d="M17 2h5v5" />
  </svg>
</template>
