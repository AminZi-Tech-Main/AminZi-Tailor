/**
 * Marks an English string that is translated later with t(variable).
 * It returns the string unchanged; `npm run i18n:check` finds these the same way as calls to the t function.
 */
export const tk = <S extends string>(s: S): S => s;
