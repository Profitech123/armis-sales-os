// Minimal chainable stand-in for a Supabase PostgrestFilterBuilder. Records
// every chained method call so tests can assert on filters/ordering/cursors
// without a live database, and resolves like the real thenable builder.

export type StubCall = { method: string; args: unknown[] };
export type StubResponse = { data: unknown[] | null; error: { code: string; message?: string } | null };

const CHAIN_METHODS = ["select", "is", "ilike", "eq", "in", "order", "limit", "or", "gt", "lt", "neq", "insert", "update", "delete"] as const;

function makeBuilder(calls: StubCall[], response: StubResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => Promise.resolve({ data: response.data?.[0] ?? null, error: response.error });
  builder.single = () => Promise.resolve({ data: response.data?.[0] ?? null, error: response.error });
  builder.then = (resolve: (value: StubResponse) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject);
  return builder;
}

/** One query = one response. Every `.from()` call returns the same response. */
export function createSupabaseStub(response: StubResponse) {
  const calls: StubCall[] = [];
  const from = (table: string) => {
    calls.push({ method: "from", args: [table] });
    return makeBuilder(calls, response);
  };
  return { supabase: { from }, calls };
}

/** Each successive `.from()` call consumes the next response, in order — for testing multi-batch fetch loops. */
export function createSequentialSupabaseStub(responses: StubResponse[]) {
  let index = 0;
  const callsPerQuery: StubCall[][] = [];
  const from = (table: string) => {
    const calls: StubCall[] = [{ method: "from", args: [table] }];
    callsPerQuery.push(calls);
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return makeBuilder(calls, response);
  };
  return { supabase: { from }, callsPerQuery };
}
