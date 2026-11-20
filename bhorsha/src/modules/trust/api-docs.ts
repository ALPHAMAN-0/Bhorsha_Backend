import type { SchemaObject } from '@nestjs/swagger';
import { CaseStatus, CaseType } from './entities/support-case.entity.js';
import { StrikeStatus } from './entities/strike.entity.js';

/**
 * Swagger documentation for the support endpoints. Their handlers take a plain
 * body and validate it in the services (input.ts), so Swagger can't infer the
 * fields: without these schemas Swagger UI shows no body to fill in.
 * Documentation only; nothing here changes what the API accepts.
 */

const id = (description: string, example: number): SchemaObject => ({
  type: 'integer',
  minimum: 1,
  description,
  example,
});

export const CREATE_CASE_BODY: SchemaObject = {
  type: 'object',
  required: ['type', 'description'],
  properties: {
    type: { type: 'string', enum: Object.values(CaseType), example: CaseType.OVERCHARGE },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 4000,
      example: 'The driver asked for Tk 300 instead of the locked Tk 260',
    },
    subjectId: id('The user you report (the driver or a co-rider), never yourself', 5),
    rideId: id('The ride the case is about', 1),
    amountClaimedTk: {
      type: 'number',
      minimum: 0.01,
      description: 'OVERCHARGE only, and required for it: what was demanded, in Tk (up to 2 decimals)',
      example: 300,
    },
  },
};

export const UPDATE_CASE_BODY: SchemaObject = {
  type: 'object',
  description: 'Send at least one field. UPHELD and DISMISSED need assignedTo and resolution.',
  properties: {
    assignedTo: id('The officer handling the case', 2),
    status: {
      type: 'string',
      enum: Object.values(CaseStatus),
      description: 'OPEN or UNDER_REVIEW can move to UNDER_REVIEW, UPHELD, DISMISSED or WITHDRAWN',
      example: CaseStatus.UNDER_REVIEW,
    },
    resolution: {
      type: 'string',
      maxLength: 4000,
      example: 'The driver demanded more than the locked fare',
    },
  },
};

export const UPDATE_CASE_EXAMPLES = {
  review: {
    summary: 'Take the case',
    value: { assignedTo: 2, status: CaseStatus.UNDER_REVIEW },
  },
  uphold: {
    summary: 'Uphold it',
    value: {
      status: CaseStatus.UPHELD,
      resolution: 'The driver demanded more than the locked fare',
    },
  },
};

export const CREATE_STRIKE_BODY: SchemaObject = {
  type: 'object',
  required: ['caseId', 'userId', 'reason'],
  properties: {
    caseId: id('An UPHELD case', 1),
    userId: id("The case's subject (the person reported)", 5),
    reason: {
      type: 'string',
      minLength: 1,
      maxLength: 2000,
      example: 'Demanded more than the locked fare',
    },
  },
};

export const UPDATE_STRIKE_BODY: SchemaObject = {
  type: 'object',
  description: 'Send at least one field.',
  properties: {
    reason: { type: 'string', minLength: 1, maxLength: 2000, example: 'Demanded Tk 300 against a locked Tk 260' },
    expiresAt: {
      type: 'string',
      format: 'date-time',
      description: 'A future date',
      example: '2027-03-01T00:00:00Z',
    },
  },
};

export const APPEAL_BODY: SchemaObject = {
  type: 'object',
  required: ['statement'],
  properties: {
    statement: {
      type: 'string',
      minLength: 1,
      maxLength: 4000,
      example: 'The rider agreed to pay the bridge toll on top of the fare',
    },
  },
};

export const DECIDE_APPEAL_BODY: SchemaObject = {
  type: 'object',
  required: ['status', 'decisionReason'],
  properties: {
    status: { type: 'string', enum: ['ACCEPTED', 'REJECTED'], example: 'ACCEPTED' },
    decisionReason: { type: 'string', minLength: 1, maxLength: 4000, example: 'The toll receipt was provided' },
  },
};

export const CASE_STATUS_QUERY = {
  name: 'status',
  required: false,
  enum: Object.values(CaseStatus),
};

export const STRIKE_STATUS_QUERY = {
  name: 'status',
  required: false,
  enum: Object.values(StrikeStatus),
};
