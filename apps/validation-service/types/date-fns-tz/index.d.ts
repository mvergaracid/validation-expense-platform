declare module 'date-fns-tz' {
  export function fromZonedTime(
    date: string | number | Date,
    timeZone: string,
  ): Date;

  export function toZonedTime(
    date: string | number | Date,
    timeZone: string,
  ): Date;
}
