import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

const STORAGE_KEY = 'janvani.lang';

const initialLang = (() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'hi' || stored === 'mr') return stored;
  } catch {
    // ignore storage access errors
  }
  return 'en';
})();

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: 'en',
    initImmediate: false,
    react: {
      useSuspense: false,
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore storage access errors
  }
  document.documentElement.lang = lng;
});

// Set initial lang attribute
document.documentElement.lang = initialLang;

export default i18n;
