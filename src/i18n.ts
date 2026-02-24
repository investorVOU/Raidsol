import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';
import de from './locales/de.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, es, pt, fr, zh, ru, tr, ko, ja, de },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['navigator'],
      caches: [],
    },
  });

export default i18n;
