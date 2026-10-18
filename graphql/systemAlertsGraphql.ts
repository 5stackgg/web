import gql from "graphql-tag";

export const systemAlertFields = {
  id: true,
  type: true,
  title: true,
  message: true,
  is_active: true,
  dismissible: true,
  expires_at: true,
  created_at: true,
} as const;

export const systemAlertAdminFields = {
  ...systemAlertFields,
  created_by: true,
  updated_at: true,
} as const;

// On/off periods reaching into [from, to): started before `to` and still on
// or ended after `from`. Raw gql because zeus doesn't know the table yet;
// callers gate it on schemaHasField(system_alerts, activations). The times
// are inlined so nothing assumes the columns' scalar type.
export function systemAlertActivationsSubscription(from: string, to: string) {
  return gql`
    subscription SystemAlertActivations {
      system_alert_activations(
        where: {
          started_at: { _lt: ${JSON.stringify(to)} }
          _or: [
            { ended_at: { _is_null: true } }
            { ended_at: { _gt: ${JSON.stringify(from)} } }
          ]
        }
      ) {
        alert_id
        started_at
        ended_at
        estimated
        started_by {
          name
          steam_id
        }
        ended_by {
          name
          steam_id
        }
      }
    }
  `;
}
