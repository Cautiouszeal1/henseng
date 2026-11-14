// Stub for optional peer dependencies of @coinbase/cdp-sdk (x402 payment
// add-ons), which is pulled in through the Base Account wallet connector.
// HENSENG never uses x402 payments. Every export throws if called, so an
// accidental use fails loudly instead of silently doing nothing.
function unavailable(name) {
  const fn = function () {
    throw new Error(`${name} (x402) is not available in HENSENG`);
  };
  return fn;
}
export const AuthCaptureEvmScheme = unavailable("AuthCaptureEvmScheme");
export const BatchSettlementEvmScheme = unavailable("BatchSettlementEvmScheme");
export const BuilderCodeClientExtension = unavailable("BuilderCodeClientExtension");
export const BUILDER_CODE = undefined;
export const BUILDER_CODE_PATTERN = undefined;
export const BUILDER_CODE_SCHEMA = undefined;
export const builderCodeResourceServerExtension = undefined;
export const bazaarResourceServerExtension = undefined;
export const ExactEvmScheme = unavailable("ExactEvmScheme");
export const ExactEvmSchemeV1 = unavailable("ExactEvmSchemeV1");
export const ExactSvmScheme = unavailable("ExactSvmScheme");
export const ExactSvmSchemeV1 = unavailable("ExactSvmSchemeV1");
export const UptoEvmScheme = unavailable("UptoEvmScheme");
export const UptoSvmScheme = unavailable("UptoSvmScheme");
export const HTTPFacilitatorClient = unavailable("HTTPFacilitatorClient");
export const PaymentRequirementsV1Schema = undefined;
export const PaymentRequirementsV2Schema = undefined;
export const paymentMiddlewareFromConfig = unavailable("paymentMiddlewareFromConfig");
export const paymentMiddlewareFromHTTPServer = unavailable("paymentMiddlewareFromHTTPServer");
export const registerExactEvmScheme = unavailable("registerExactEvmScheme");
export const toClientEvmSigner = unavailable("toClientEvmSigner");
export const wrapFetchWithPayment = unavailable("wrapFetchWithPayment");
export const x402Client = unavailable("x402Client");
export const x402ResourceServer = unavailable("x402ResourceServer");
export const x402HTTPResourceServer = unavailable("x402HTTPResourceServer");
const stub = {};
export default stub;
