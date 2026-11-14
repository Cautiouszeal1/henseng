import type { PaymentRequest } from "@henseng/wallet";

/** Hands a QR scan result back to the screen that opened the scanner. */
let listener: ((r: PaymentRequest) => void) | null = null;

export function onScanResult(fn: (r: PaymentRequest) => void) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/** Returns true if a waiting screen took the result. */
export function deliverScanResult(r: PaymentRequest): boolean {
  if (!listener) return false;
  listener(r);
  return true;
}
