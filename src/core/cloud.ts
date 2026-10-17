/* The server that keeps a copy of the state (Supabase): where it is, and how a call to it is signed. Pure.
   The address and the publishable key are public by nature: they go in the page and in every call, and what each person
   may read or write is decided on the server by the policies of supabase/schema.sql, not by keeping them hidden. The
   secret key never goes in here. Formats checked against the Supabase Auth OpenAPI (supabase/auth, openapi.yaml) and
   the official JS client (supabase/supabase-js, the module that signs its requests), on 17/10/2026. */

/** The project (given by Lucas on 17/10/2026). Empty, the card does not show and nothing is ever called. The end-to-end
 *  test puts a simulated server in their place. tests/docs_check.py fails if the key is ever not a publishable one. */
export const CLOUD_URL = 'https://ikrrgbawrwwltreglktd.supabase.co';
export const CLOUD_KEY = 'sb_publishable_SAZ2EcwhwFJDYD-tx8m2DA_7b32C1Ar';
/** Whether an address and a key make a project: an address of Supabase and a publishable key. */
export const cloudSet = (url: string, key: string): boolean => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) && /^sb_publishable_[\w-]{10,}$/.test(key);

/** The headers of a call: the key always goes in `apikey`. A key of the new format (`sb_publishable_`, `sb_secret_`) is not
 *  a token and never goes in `Authorization`; the person's token does, once there is one. An old-format key (a token
 *  itself) stands in for the person's token while there is none, as the official client does. */
export function cloudHeaders(key: string, token: string | null): Record<string, string> {
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  const bearer = token || (/^sb_(publishable|secret)_/.test(key) ? null : key);
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  return h;
}
/** How long before a token expires it is renewed. */
export const TOKEN_MARGIN = 60e3;
/** The shortest password the app accepts, the same the project asks for (Authentication, Email, "Minimum password
 *  length"), and the longest one the server can check (it keeps a bcrypt hash, which reads 72 bytes). */
export const MIN_PASSWORD = 8, MAX_PASSWORD = 72;
export const isPassword = (s: string): boolean => typeof s === 'string' && s.length >= MIN_PASSWORD && new TextEncoder().encode(s).length <= MAX_PASSWORD;
export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
