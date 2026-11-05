import { makeVar } from '@apollo/client';
import { isEmpty } from 'radash';
import LocalStorage from '/imports/ui/services/storage/local';
import SessionStorage from '/imports/ui/services/storage/session';
import {
  CHANGED_SETTINGS,
  DEFAULT_SETTINGS,
  SETTINGS,
  MEETING_SCOPED_SETTINGS,
  SETTINGS_STORAGE_FLAGS,
} from './enums';
import getFromUserSettings from '/imports/ui/services/users-settings';
import Auth from '/imports/ui/services/auth';
import { isSystemThemeAutoDetectEnabled, systemPrefersDarkTheme } from './system-theme';

// A group named in SETTINGS_STORAGE_FLAGS answers to a public.app flag of its
// own rather than to userSettingsStorage. 'session' - the default - keeps it
// in sessionStorage under a meeting-scoped key, so its value follows the user
// into neither a new browser session nor a new meeting; 'local' opts out and
// leaves the group to the ordinary rules.
export const isSessionScoped = (settingGroup) => {
  const flag = SETTINGS_STORAGE_FLAGS[settingGroup.replace('_', '')];
  if (!flag) return false;

  return window.meetingClientSettings.public.app[flag] !== 'local';
};

// userSettingsStorage picks the backend for every group that isn't scoped to
// the session by a flag of its own.
const getStorageFor = (settingGroup) => {
  if (isSessionScoped(settingGroup)) return SessionStorage;

  const APP_CONFIG = window.meetingClientSettings.public.app;

  return (APP_CONFIG.userSettingsStorage === 'local') ? LocalStorage : SessionStorage;
};

class Settings {
  constructor(defaultValues = {}) {
    const writableDefaultValues = JSON.parse(JSON.stringify(defaultValues));
    Object.values(SETTINGS).forEach((p) => {
      const privateProp = `_${p}`;
      this[privateProp] = {
        reactiveVar: makeVar(undefined),
      };

      const varProp = `${p}Var`;
      Object.defineProperty(this, varProp, {
        get: () => this[privateProp].reactiveVar,
      });

      Object.defineProperty(this, p, {
        get: () => this[privateProp].reactiveVar(),

        set: (v) => {
          this[privateProp].reactiveVar(v);
        },
      });
    });
    this.defaultSettings = {};
    // Sets default locale to browser locale
    writableDefaultValues.application.locale = navigator.languages ? navigator.languages[0] : false
      || navigator.language
      || writableDefaultValues.application.locale;

    const showAnimationsDefault = getFromUserSettings(
      'bbb_show_animations_default',
      window.meetingClientSettings.public.app.defaultSettings.application.animations,
    );

    // When system auto-detect is enabled, the OS prefers-color-scheme becomes
    // the default theme; otherwise fall back to the configured default. The
    // bbb_prefer_dark_theme parameter (handled by getFromUserSettings) still
    // takes precedence over both.
    const darkThemeDefault = isSystemThemeAutoDetectEnabled()
      ? systemPrefersDarkTheme()
      : window.meetingClientSettings.public.app.defaultSettings.application.darkTheme;

    // darkTheme.enabled=false means the theme is not offered, so nothing may
    // hand it back: not the bbb_prefer_dark_theme join parameter, not a value
    // stored by an older client. Honouring the parameter regardless of the flag
    // is what let a stale link, or a bookmark made while the feature was on,
    // put one member in a dark client while the room around them stayed light.
    const darkThemeOffered = window.meetingClientSettings.public.app.darkTheme?.enabled;

    const showDarkThemeDefault = darkThemeOffered
      ? getFromUserSettings('bbb_prefer_dark_theme', darkThemeDefault)
      : false;

    writableDefaultValues.application.animations = showAnimationsDefault;
    writableDefaultValues.application.darkTheme = showDarkThemeDefault;

    this.setDefault(writableDefaultValues);
    this.loadChanged();

    // loadChanged() merges the persisted "changed" blob over the defaults, so a
    // stored dark selection outlives the clamp above. Reassert the default.
    if (!darkThemeOffered && this.application?.darkTheme) {
      this.application = { ...this.application, darkTheme: false };
    }
  }

  static getStorageKey({ prepend = '', value }) {
    const cleanKeyValue = value.replace('_', '');
    if (MEETING_SCOPED_SETTINGS.includes(cleanKeyValue) || isSessionScoped(value)) {
      return `${prepend}${value}-${Auth.meetingID}`;
    }
    return `${prepend}${value}`;
  }

  setDefault(defaultValues) {
    Object.keys(defaultValues).forEach((key) => {
      this[key] = defaultValues[key];
      this.defaultSettings[`_${key}`] = defaultValues[key];
    });

    this.save(undefined, DEFAULT_SETTINGS);
  }

  loadChanged() {
    const savedSettings = {};

    Object.values(SETTINGS).forEach((s) => {
      const storageKey = Settings.getStorageKey({ prepend: CHANGED_SETTINGS, value: `_${s}` });
      savedSettings[s] = getStorageFor(s).getItem(storageKey);
    });

    Object.keys(savedSettings).forEach((key) => {
      const savedItem = savedSettings[key];
      if (!savedItem) return;
      this[key] = {
        ...this[key],
        ...savedItem,
      };
    });
  }

  save(mutation, settings = CHANGED_SETTINGS) {
    if (settings === CHANGED_SETTINGS) {
      Object.keys(this).forEach((k) => {
        const values = this[k].reactiveVar && this[k].reactiveVar();
        const defaultValues = this.defaultSettings[k];

        if (!values) return;
        const changedValues = Object.keys(values)
          .filter((item) => values[item] !== defaultValues[item])
          .reduce((acc, item) => ({
            ...acc,
            [item]: values[item],
          }), {});

        const Storage = getStorageFor(k);
        const storageKey = Settings.getStorageKey({ prepend: settings, value: k });
        if (isEmpty(changedValues)) Storage.removeItem(storageKey);
        Storage.setItem(storageKey, changedValues);
      });
    } else {
      Object.keys(this).forEach((k) => {
        getStorageFor(k).setItem(`${settings}${k}`, this[k].value);
      });
    }

    const userSettings = {};

    Object.values(SETTINGS).forEach((e) => {
      userSettings[e] = this[e];
    });

    if (typeof mutation === 'function') {
      mutation(userSettings);
    }
  }
}

// Whether a given key inside a settings group has been persisted as a
// user-changed value (i.e. it differs from the default). Used to detect an
// explicit user choice that should override auto-detected defaults.
export const hasPersistedChange = (settingGroup, key) => {
  const storageKey = Settings.getStorageKey({ prepend: CHANGED_SETTINGS, value: `_${settingGroup}` });
  const saved = getStorageFor(settingGroup).getItem(storageKey);
  return Boolean(saved && Object.prototype.hasOwnProperty.call(saved, key));
};

let SettingsSingleton = null;
export const getSettingsSingletonInstance = () => {
  if (!SettingsSingleton) {
    SettingsSingleton = new Settings(window.meetingClientSettings.public.app.defaultSettings);
  }
  return SettingsSingleton;
};

export default getSettingsSingletonInstance;
