/**
 * Throws the Supabase error if present, otherwise returns data.
 * Replaces the recurring pattern: `const { data, error } = await ...; if (error) throw error;`
 *
 * Usage:
 *   const data = assertNoError(await supabase.from('table').select());
 */
export function assertNoError<T>(result: {
  data: T;
  error: { message: string } | null | undefined;
}): T {
  if (result.error) throw result.error;
  return result.data;
}
