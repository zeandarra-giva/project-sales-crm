export type NotificationType =
  | 'StageChange'
  | 'DealStuck'
  | 'ActionPlanDue'
  | 'QuotaAlert'
  | 'FollowUpDue'
  | 'NewDealAssigned'
  | 'LostDealFollowUp';

export interface Notification {
  id: string;
  content: string;
  type: NotificationType;
  is_read: boolean;
  triggered_by: string;
  scheduled_at?: string;
  created_at: string;
  bd_id: string;
  deal_id?: string;
  deal?: import('./deal').Deal;
}
