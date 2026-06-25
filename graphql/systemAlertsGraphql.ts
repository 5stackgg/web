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
