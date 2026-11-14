/**
 * Testnet and mainnet activity must never be mixed (spec §1.4, §24.11).
 * Every fee, revenue, points and analytics record carries one of these values.
 */
export const ENVIRONMENTS = ["TESTNET", "MAINNET"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export function assertEnvironment(value: unknown): asserts value is Environment {
  if (value !== "TESTNET" && value !== "MAINNET") {
    throw new Error(`Invalid environment: ${String(value)}`);
  }
}
