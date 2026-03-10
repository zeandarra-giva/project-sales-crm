export type DecisionRank =
  | 'TIER_1_ECONOMIC_BUYER'
  | 'TIER_2_DECISION_MAKER'
  | 'TIER_3_INFLUENCER'
  | 'TIER_4_END_USER'
  | 'TIER_5_GATEKEEPER';

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  number?: string;
  designation?: string;
  decision_rank: DecisionRank;
  is_primary: boolean;
  client_id: string;
  client?: import('./client').Client;
}
