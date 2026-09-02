import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import bn from './locales/bn.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import mr from './locales/mr.json';
import ne from './locales/ne.json';
import or from './locales/or.json';
import pa from './locales/pa.json';
import sa from './locales/sa.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import ur from './locales/ur.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';

const resources = {
  en: { translation: en },
  bn: { translation: bn },
  gu: { translation: gu },
  hi: { translation: hi },
  kn: { translation: kn },
  ml: { translation: ml },
  mr: { translation: mr },
  ne: { translation: ne },
  or: { translation: or },
  pa: { translation: pa },
  sa: { translation: sa },
  ta: { translation: ta },
  te: { translation: te },
  ur: { translation: ur },
  de: { translation: de },
  fr: { translation: fr },
  ja: { translation: ja },
  zh: { translation: zh },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
