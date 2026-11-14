/** Web/extension: the API session token. It grants HENSENG account access only, never wallet funds. */
const KEY = "henseng.apiToken.v1";

export const loadToken = async () => (typeof localStorage === "undefined" ? null : localStorage.getItem(KEY));
export const saveToken = async (t: string) => localStorage.setItem(KEY, t);
export const clearToken = async () => localStorage.removeItem(KEY);
