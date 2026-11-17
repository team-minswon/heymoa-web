import type { Locale } from "./locales";

export type LanguageSyncAction = {
  cookie?: Locale;
  account?: Locale;
};

export function decideLanguageSync({
  account,
  cookie,
  screen,
}: {
  account: Locale | null;
  cookie: Locale | null;
  screen: Locale;
}): LanguageSyncAction {
  if (account) {
    return cookie === account ? {} : { cookie: account };
  }
  return cookie === screen ? { account: screen } : { account: screen, cookie: screen };
}
