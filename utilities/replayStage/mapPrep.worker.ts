import {
  prepareMap,
  type PrepArea,
  type PrepChunk,
  type PrepResult,
} from "./mapPrep";

type PrepRequest = { chunks: PrepChunk[]; areas: PrepArea };

self.addEventListener("message", (event: MessageEvent<PrepRequest>) => {
  const result: PrepResult = prepareMap(event.data.chunks, event.data.areas);
  const transfer: Transferable[] = [
    result.pick.start.buffer,
    result.pick.items.buffer,
    result.ground.z.buffer,
    result.ground.enclosed.buffer,
    result.ground.open.buffer,
  ];
  for (const mesh of [result.solid, result.seeThrough]) {
    transfer.push(
      mesh.positions.buffer,
      mesh.height.buffer,
      mesh.info.buffer,
      mesh.cut.buffer,
      mesh.remote.buffer,
      mesh.canopy.buffer,
    );
  }
  self.postMessage(result, { transfer });
});
