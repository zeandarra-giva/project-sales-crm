export type NotificationType =
  | 'STAGE_CHANGE'
  | 'DEAL_STUCK'
  | 'ACTION_PLAN_DUE'
  | 'QUOTA_ALERT'
  | 'FOLLOW_UP_DUE'
  | 'NEW_DEAL_ASSIGNED'
  | 'LOST_DEAL_FOLLOW_UP';

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