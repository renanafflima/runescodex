import { isMissingPublishIdempotencyStore } from './community-rotation-publish.idempotency';

describe('isMissingPublishIdempotencyStore', () => {
  it('detects a missing idempotency table', () => {
    const error = Object.assign(new Error('Table does not exist'), {
      code: 'P2021',
      meta: { modelName: 'CommunityRotationPublishIdempotency' },
    });
    expect(isMissingPublishIdempotencyStore(error)).toBe(true);
  });

  it('does not treat missing CommunityRotation visibility as idempotency store', () => {
    const error = Object.assign(new Error('Column does not exist'), {
      code: 'P2022',
      meta: { modelName: 'CommunityRotation', column_name: 'visibility' },
    });
    expect(isMissingPublishIdempotencyStore(error)).toBe(false);
  });
});