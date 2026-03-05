export type DecisionRank =
  | 'Tier 1 Economic Buyer'
  | 'Tier 2 Decision Maker'
  | 'Tier 3 Influencer'
  | 'Tier 4 End User'
  | 'Tier 5 Gatekeeper';

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
