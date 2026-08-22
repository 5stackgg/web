<!--
  The button that turns the meta overlay on carries no label at any width, so
  the glyph has to do the whole job: it is the overlay in miniature. The board
  paints mined spots as dashed rings whose radius and stroke weight scale with
  how many players were seen throwing there, so this is two of those rings, one
  heavy and one light, sitting off each other the way a real cluster does.

  Everything here is sized for 16px, which is where it actually lives, and the
  numbers were picked by rasterising candidates at 16px rather than by eye at
  full size. Two rules came out of that:

    - Four arcs on the big ring, three on the small. Eight arcs is the honest
      count next to the board's 5/6 dasharray, and at 16px it rasterises to a
      ring of loose pixels -- the gaps land under a pixel and the whole glyph
      reads as noise. Long arcs with wide gaps survive the downsample.
    - Two rings, not three. A third circle is legible at 24px and a smudge at
      16px, and the two remaining ones stop being readable next to it.

  Each dasharray divides its own circumference into a whole number of periods
  (43.354 = 4 x 10.839, 26.389 = 3 x 8.796), so neither ring closes on a part
  arc -- at this size that stub reads as a dent rather than as a dash.

  Template only, one root <svg>: `class` falls through from the call site, so the
  button variant's [&_svg]:size-4 lands on it like it does on a lucide icon.
-->
<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <!-- The heavy spot: more throwers, so the wider ring and the thicker
         stroke, the way the board weights them. -->
    <circle
      cx="8.6"
      cy="13.8"
      r="6.9"
      fill="currentColor"
      fill-opacity="0.2"
      stroke-width="2.2"
      stroke-dasharray="6.72 4.119"
    />
    <!-- The lighter one, offset so the pair reads as a cluster and not as a
         target. Its dashes start mid-arc so the two rings do not rhyme. -->
    <circle
      cx="17.6"
      cy="8"
      r="4.2"
      fill="currentColor"
      fill-opacity="0.15"
      stroke-width="2"
      stroke-dasharray="5.454 3.343"
      stroke-dashoffset="2"
    />
  </svg>
</template>
