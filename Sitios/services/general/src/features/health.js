/** Feature de control. Sin secretos ni side-effects. */
export async function health() {
  return {
    ok: true,
    service: "general",
    time: new Date().toISOString(),
  };
}
