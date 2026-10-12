import { runPrep, type PrepRequest } from "./mapPrepPack";

self.addEventListener("message", (event: MessageEvent<PrepRequest>) => {
  const reply = runPrep(event.data);
  const { result, packed } = reply;
  const transfer: Transferable[] = [
    result.pick.start.buffer,
    result.pick.items.buffer,
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
  if (packed) {
    transfer.push(packed);
  }
  // The ground's arrays may be views into the core sent in: copy, not move.
  self.postMessage(reply, { transfer });
});
