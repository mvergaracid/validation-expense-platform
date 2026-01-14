export type RgbTriplet = `${number} ${number} ${number}`;

export interface ThemeConfig {
  COLOR_BG?: RgbTriplet;
  COLOR_SURFACE?: RgbTriplet;
  COLOR_BORDER?: RgbTriplet;
  COLOR_TEXT?: RgbTriplet;
  COLOR_TEXT_MUTED?: RgbTriplet;
  COLOR_PRIMARY?: RgbTriplet;
  COLOR_PRIMARY_FG?: RgbTriplet;
  COLOR_SUCCESS?: RgbTriplet;
  COLOR_SUCCESS_FG?: RgbTriplet;
  COLOR_DANGER?: RgbTriplet;
  COLOR_DANGER_FG?: RgbTriplet;
}

export interface AppConfig {
  API_URL: string;
  THEME?: ThemeConfig;
}
