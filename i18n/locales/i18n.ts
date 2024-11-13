export default defineI18nLocale(async (locale) => {
  const storedI18n = localStorage.getItem(`i18n_${locale}`);

  if (storedI18n) {
    return JSON.parse(storedI18n);
  } else {
    const i18n = JSON.parse(
      await $fetch(
        `https://raw.githubusercontent.com/5stackgg/i18n/refs/heads/main/${locale}.json`,
      ),
    );
    localStorage.setItem(`i18n_${locale}`, JSON.stringify(i18n));
    return i18n;
  }
});
