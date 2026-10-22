// The getNodeStats selections behind fetchNodeStats (nodeMetrics.ts).
import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

const sampleFields = { time: true, total: true, used: true };

export const SLIM_QUERY = generateQuery({
  getNodeStats: [
    { node: $("node", "String!") },
    {
      node: true,
      cpu: [{}, sampleFields],
      memory: [{}, sampleFields],
    },
  ],
});

export const SLIM_GPU_QUERY = generateQuery({
  getNodeStats: [
    { node: $("node", "String!") },
    {
      node: true,
      cpu: [{}, sampleFields],
      memory: [{}, sampleFields],
      gpu: [{}, { time: true, devices: { utilization_percent: true } }],
    },
  ],
});

export const FULL_QUERY = generateQuery({
  getNodeStats: [
    { node: $("node", "String!") },
    {
      node: true,
      cpu: [{}, sampleFields],
      memory: [{}, sampleFields],
      disks: [
        {},
        {
          time: true,
          disks: {
            filesystem: true,
            size: true,
            used: true,
            available: true,
            usedPercent: true,
            mountpoint: true,
          },
        },
      ],
      network: [{}, { time: true, nics: { name: true, rx: true, tx: true } }],
      gpu: [
        {},
        {
          time: true,
          devices: {
            index: true,
            name: true,
            memory_mb: true,
            memory_used_mb: true,
            temperature_c: true,
            power_w: true,
            utilization_percent: true,
          },
        },
      ],
    },
  ],
});
