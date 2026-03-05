import { clsx, type ClassValue } from 'clsx';
import type { PipelineStage } from '../types/index';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, compact = false): string {
  if (compact && amount >= 1_000_000) {
    return `₱${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (compact && amount >= 1_000) {
    return `₱${(amount / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateStr);
}

export function getStageColor(stage: PipelineStage): string {
  const colors: Record<PipelineStage, string> = {
    'Inquiry': '#4a4f6b',
    'Prospecting': '#4f6ef7',
    'Discovery': '#10b981',
    'Proposal Sent': '#8b5cf6',
    'Negotiation': '#f59e0b',
    'Closed Won': '#10b981',
    'Closed Lost': '#f43f5e',
  };
  return colors[stage] || '#4a4f6b';
}

export function getStageClass(stage: PipelineStage): string {
  const classes: Record<PipelineStage, string> = {
    'Inquiry': 'stage-inquiry',
    'Prospecting': 'stage-prospecting',
    'Discovery': 'stage-discovery',
    'Proposal Sent': 'stage-proposal',
    'Negotiation': 'stage-negotiation',
    'Closed Won': 'stage-closed-won',
    'Closed Lost': 'stage-closed-lost',
  };
  return classes[stage] || 'stage-inquiry';
}

export function getProbabilityForStage(stage: PipelineStage): number {
  const probs: Record<PipelineStage, number> = {
    'Inquiry': 10,
    'Prospecting': 20,
    'Discovery': 40,
    'Proposal Sent': 60,
    'Negotiation': 75,
    'Closed Won': 100,
    'Closed Lost': 0,
  };
  return probs[stage] || 0;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

export function isStuck(daysInStage: number, targetDays = 3): boolean {
  return daysInStage > targetDays;
}
