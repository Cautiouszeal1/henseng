/**
 * Web/extension: the browser SDK stores history in this origin's private file
 * system (OPFS) and does not use a separate database key. Messages are
 * end-to-end encrypted on the network either way.
 */
export async function getDbKey(): Promise<Uint8Array> {
  return new Uint8Array(32);
}
