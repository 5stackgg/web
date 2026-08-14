import { onMounted, onBeforeUnmount, type Ref } from "vue";
import type { CameraReframe } from "~/composables/useCameraReframe";

// Wheel, pinch and drag over the camera stage, translated into reframe values.
// Pure input: it never touches media, it only moves the numbers useCameraReframe
// draws from.

export type CameraGestureOptions = {
  stageEl: Ref<HTMLElement | null>;
  // The frame is letterboxed inside the stage, so a drag has to be measured
  // against the picture rather than the box it sits in -- and which element is
  // showing the picture depends on whether the crop is active.
  previewEl: Ref<HTMLVideoElement | null>;
  canvasEl: Ref<HTMLCanvasElement | null>;
  reframe: CameraReframe;
  // False while there is no camera, or while the preview is hidden -- dragging a
  // stage the player cannot see is not a gesture, it is an accident.
  enabled: () => boolean;
};

export function useCameraGestures(options: CameraGestureOptions) {
  const { stageEl, previewEl, canvasEl, reframe } = options;

  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let pinchZoom = 1;
  let dragOrigin = { pointerX: 0, pointerY: 0, x: 0.5, y: 0.5 };

  // Registered by hand because the modifier form leaves the listener passive on
  // some engines, and a passive wheel handler cannot stop the page scrolling.
  function onWheel(event: WheelEvent) {
    if (!options.enabled()) {
      return;
    }

    event.preventDefault();

    const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    reframe.setZoom(
      reframe.reframe.zoom * Math.exp((-event.deltaY * lines) / 700),
    );
  }

  function pointerDistance() {
    const [first, second] = [...pointers.values()];

    if (!first || !second) {
      return 0;
    }

    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function pictureSize(rect: DOMRect) {
    const el = previewEl.value;
    const canvas = canvasEl.value;
    const ratio = reframe.cropping.value
      ? canvas && canvas.width && canvas.height
        ? canvas.width / canvas.height
        : 0
      : el && el.videoWidth && el.videoHeight
        ? el.videoWidth / el.videoHeight
        : 0;

    if (!ratio || !rect.width || !rect.height) {
      return { width: rect.width, height: rect.height };
    }

    if (rect.width / rect.height > ratio) {
      return { width: rect.height * ratio, height: rect.height };
    }

    return { width: rect.width, height: rect.width / ratio };
  }

  function onPointerDown(event: PointerEvent) {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      pinchDistance = pointerDistance();
      pinchZoom = reframe.reframe.zoom;
      reframe.dragging.value = false;
      return;
    }

    if (pointers.size === 1 && reframe.cropping.value) {
      reframe.dragging.value = true;
      dragOrigin = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: reframe.reframe.x,
        y: reframe.reframe.y,
      };
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) {
      return;
    }

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      const distance = pointerDistance();

      if (pinchDistance > 0 && distance > 0) {
        reframe.setZoom(pinchZoom * (distance / pinchDistance));
      }

      return;
    }

    if (!reframe.dragging.value) {
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const picture = pictureSize(rect);

    if (!picture.width || !picture.height) {
      return;
    }

    // Dragging moves the picture, so the crop window travels the other way, and
    // the preview is already magnified by the zoom.
    reframe.reframe.x =
      dragOrigin.x -
      (event.clientX - dragOrigin.pointerX) /
        (picture.width * reframe.reframe.zoom);
    reframe.reframe.y =
      dragOrigin.y -
      (event.clientY - dragOrigin.pointerY) /
        (picture.height * reframe.reframe.zoom);
    reframe.clampCentre();
  }

  function onPointerUp(event: PointerEvent) {
    const target = event.currentTarget as HTMLElement;

    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

    pointers.delete(event.pointerId);

    if (pointers.size < 2) {
      pinchDistance = 0;
    }

    if (pointers.size === 0) {
      reframe.dragging.value = false;
      reframe.persist();
    }
  }

  onMounted(() => {
    stageEl.value?.addEventListener("wheel", onWheel, { passive: false });
  });

  onBeforeUnmount(() => {
    stageEl.value?.removeEventListener("wheel", onWheel);
  });

  return { onPointerDown, onPointerMove, onPointerUp };
}
