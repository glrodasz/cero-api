/** Supabase injects these into every Edge Function, both locally and once deployed. */
const requireEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (value === undefined) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

export const config = {
  supabaseUrl: requireEnv("SUPABASE_URL"),
  serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
};
