/**
 * The upstream link rules' refusals (BACKEND_API.md, Topology → Upstream link
 * rules, DEV-181..183), matched on the backend's English wording and said in
 * Spanish. Shared by the device form and the suggestions' bulk accept, which
 * answers with the same messages.
 */
const LINK_REFUSALS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/Cannot make a device its own upstream device/, () => 'Un equipo no puede colgar de sí mismo.'],
  [
    /^(.+) is already downstream of (.+) — linking them would form a loop/,
    (m) => `«${m[1]}» ya cuelga (directa o indirectamente) de «${m[2]}»: enlazarlos formaría un ciclo.`,
  ],
  [/Upstream device not found/, () => 'El equipo del que cuelga no existe o fue eliminado.'],
  [
    /The upstream device must be ACTIVE or COMMISSIONING, not (\w+)/,
    () => 'El equipo del que cuelga debe estar activo o en instalación.',
  ],
];

/** The Spanish refusal, or null when `raw` is not about the upstream link. */
export function upstreamLinkError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  for (const [pattern, say] of LINK_REFUSALS) {
    const m = raw.match(pattern);
    if (m) return say(m);
  }
  return null;
}
