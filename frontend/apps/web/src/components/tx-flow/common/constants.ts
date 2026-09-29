export const TOOLTIP_TITLES = {
  THRESHOLD:
    'The threshold of a multi-sig account specifies how many signers need to confirm a multi-sig account transaction before it can be executed.',
  REVIEW_WINDOW:
    'A period that begins after a recovery is submitted on-chain, during which the multi-sig account signers can review the proposal and cancel it before it is executable.',
  PROPOSAL_EXPIRY: 'A period after which the recovery proposal will expire and can no longer be executed.',
} as const
