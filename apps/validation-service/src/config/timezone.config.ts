import { config } from 'dotenv';
import { toZonedTime } from 'date-fns-tz';

config();

const DEFAULT_TIMEZONE = 'UTC';

export const getAppTimezone = (): string => {
  const tz = process.env.APP_TIMEZONE?.trim();
  return tz && tz.length > 0 ? tz : DEFAULT_TIMEZONE;
};

export const getZonedNow = (): Date => {
  const timezone = getAppTimezone();
  return toZonedTime(Date.now(), timezone);
};
