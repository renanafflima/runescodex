import { TicketStatus } from '../../generated/prisma/client.js';

/** Unresolved work. Terminal statuses stay RESOLVED and REJECTED. */
export const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_REVIEW,
  TicketStatus.WAITING_ON_USER,
  TicketStatus.WAITING_ON_STAFF,
];

export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [
    TicketStatus.IN_REVIEW,
    TicketStatus.WAITING_ON_USER,
    TicketStatus.WAITING_ON_STAFF,
    TicketStatus.REJECTED,
  ],
  IN_REVIEW: [
    TicketStatus.WAITING_ON_USER,
    TicketStatus.WAITING_ON_STAFF,
    TicketStatus.RESOLVED,
    TicketStatus.REJECTED,
  ],
  WAITING_ON_USER: [
    TicketStatus.IN_REVIEW,
    TicketStatus.WAITING_ON_STAFF,
    TicketStatus.RESOLVED,
    TicketStatus.REJECTED,
  ],
  WAITING_ON_STAFF: [
    TicketStatus.IN_REVIEW,
    TicketStatus.WAITING_ON_USER,
    TicketStatus.RESOLVED,
    TicketStatus.REJECTED,
  ],
  RESOLVED: [],
  REJECTED: [],
};
