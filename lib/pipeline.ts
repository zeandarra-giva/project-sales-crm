import { prisma } from './prisma.js'

// Stage names as string constants — no longer an enum, they're DB rows
export const STAGE = {
  INQUIRY:       'Inquiry',
  PROSPECTING:   'Prospecting',
  DISCOVERY:     'Discovery',
  PROPOSAL_SENT: 'Proposal Sent',
  NEGOTIATION:   'Negotiation',
  CLOSED_WON:    'Closed Won',
  CLOSED_LOST:   'Closed Lost',
} as const

export type StageName = (typeof STAGE)[keyof typeof STAGE]

export const CLOSED_STAGE_NAMES: string[] = [STAGE.CLOSED_WON, STAGE.CLOSED_LOST]

export const STAGE_PROBABILITY: Record<string, number> = {
  [STAGE.INQUIRY]:       10,
  [STAGE.PROSPECTING]:   20,
  [STAGE.DISCOVERY]:     40,
  [STAGE.PROPOSAL_SENT]: 60,
  [STAGE.NEGOTIATION]:   75,
  [STAGE.CLOSED_WON]:    100,
  [STAGE.CLOSED_LOST]:   0,
}

export function isClosedStage(stageName: string): boolean {
  return CLOSED_STAGE_NAMES.includes(stageName)
}

export function getProbability(stageName: string): number {
  return STAGE_PROBABILITY[stageName] ?? 10
}

export function getDaysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function getCurrentQuarter(date = new Date()) {
  const month   = date.getMonth()
  const quarter = Math.floor(month / 3) + 1
  const year    = date.getFullYear()
  return { quarter, year, ...getQuarterRange(year, quarter) }
}

export function getQuarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3
  const start = new Date(year, startMonth, 1)
  const end   = new Date(year, startMonth + 3, 0, 23, 59, 59, 999)
  return { start, end }
}

export function getCurrentMonth() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

/**
 * Fetch all pipeline stages from DB and return as a name→row map.
 * Use this wherever you need to resolve a stage name to its id/duration.
 */
export async function getStageMap(): Promise<Record<string, { id: string; duration: number | null }>> {
  const stages = await prisma.pipelineStage.findMany()
  const map: Record<string, { id: string; duration: number | null }> = {}
  for (const s of stages) map[s.name] = { id: s.id, duration: s.duration }
  return map
}

/**
 * Fetch a single stage by name. Throws if not found — means seed hasn't run.
 */
export async function getStageByName(name: string) {
  const stage = await prisma.pipelineStage.findUnique({ where: { name } })
  if (!stage) throw new Error(`Pipeline stage not found: "${name}". Run the seed first.`)
  return stage
}
