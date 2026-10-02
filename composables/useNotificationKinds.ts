import { useI18n } from "vue-i18n";

// Types and categories come from the api, so one it adds before the web has
// copy for it renders with a humanized name rather than a raw i18n path.
export function useNotificationKinds() {
  const { t, te } = useI18n();

  const humanize = (key: string) =>
    key
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^\w/, (c) => c.toUpperCase());

  const kindTitle = (type: string) => {
    const path = `pages.settings.notifications.catalog.kinds.${type}.title`;
    return te(path) ? t(path) : humanize(type);
  };

  const kindDescription = (type: string) => {
    const path = `pages.settings.notifications.catalog.kinds.${type}.description`;
    return te(path) ? t(path) : "";
  };

  const kindExample = (type: string) => {
    const path = `pages.settings.notifications.catalog.kinds.${type}.example`;
    return te(path) ? t(path) : "";
  };

  const categoryTitle = (key: string) => {
    const path = `pages.settings.notifications.catalog.categories.${key}.title`;
    return te(path) ? t(path) : humanize(key);
  };

  const categoryDescription = (key: string) => {
    const path = `pages.settings.notifications.catalog.categories.${key}.description`;
    return te(path) ? t(path) : "";
  };

  return {
    kindTitle,
    kindDescription,
    kindExample,
    categoryTitle,
    categoryDescription,
  };
}
