/** Money in this app is an integer number of centavos (1 peso = 100 centavos). */
export type Centavos = number;

/** Convert whole pesos to centavos. */
export function pesos(whole: number): Centavos {
  return Math.round(whole * 100);
}

const mxn = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format centavos as "$1,040.00" (no currency code; caller appends " MXN" if desired). */
export function formatMXN(centavos: Centavos): string {
  return "$" + mxn.format(centavos / 100);
}
