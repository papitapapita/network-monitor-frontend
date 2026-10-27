import type { TopologyReachability } from '@/types/topology.types';
import type { BadgeVariant } from '@/components/ui';

/**
 * The upstream link rules' refusals (BACKEND_API.md, Topology → Upstream link
 * rules, DEV-181..183), matched on the backend's English wording and said in
 * Spanish. Shared by the device form and the suggestions' bulk accept, which
 * answers with the same messages.
 */
const LINK_REFUSALS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/Cannot make a device its own upstream device/, () => 'Un equipo no puede depender de sí mismo.'],
  [
    /^(.+) is already downstream of (.+) — linking them would form a loop/,
    (m) => `«${m[1]}» ya depende (directa o indirectamente) de «${m[2]}»: enlazarlos formaría un ciclo.`,
  ],
  [/Upstream device not found/, () => 'El equipo del que depende no existe o fue eliminado.'],
  [
    /The upstream device must be ACTIVE or COMMISSIONING, not (\w+)/,
    () => 'El equipo del que depende debe estar activo o en instalación.',
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

/**
 * DEV-186. During an outage the red node is the one to send a technician to;
 * the grey ones behind it are probably fine, just cut off. `stroke` is the
 * same state as a CSS colour, for what Tailwind can't reach (map lines and pins).
 */
export const REACHABILITY: Record<
  TopologyReachability,
  { label: string; hint: string; variant: BadgeVariant; dot: string; stroke: string }
> = {
  UP: { label: 'En línea', hint: 'Respondió al último ping.', variant: 'success', dot: 'bg-green-500', stroke: '#22c55e' },
  DOWN: {
    label: 'Caído',
    hint: 'No responde y nada por encima de él está caído: aquí está la falla.',
    variant: 'danger',
    dot: 'bg-red-500',
    stroke: '#ef4444',
  },
  UNREACHABLE: {
    label: 'Sin alcance',
    hint: 'No responde, pero un equipo por encima también está caído: probablemente está aislado, no dañado.',
    variant: 'neutral',
    dot: 'bg-gray-400',
    // Greyed red: touched by the fault, not where it is.
    stroke: '#b98585',
  },
  UNKNOWN: {
    label: 'Sin datos',
    hint: 'No se monitorea, aún no se ha sondeado o su agente no está reportando.',
    variant: 'neutral',
    dot: 'bg-transparent border border-gray-400 dark:border-gray-500',
    stroke: '#cbd0d6',
  },
};
