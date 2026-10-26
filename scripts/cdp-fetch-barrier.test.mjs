import test from 'node:test';
import assert from 'node:assert/strict';
import { createFetchContinuationBarrier, safeFetchPauseMetadata } from './cdp-fetch-barrier.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const turn = () => new Promise((resolve) => setImmediate(resolve));
const pause = (id, extra = {}) => ({ requestId: id, request: { method: 'GET', headers: {} }, ...extra });
const make = (options = {}) => createFetchContinuationBarrier({ eventTurn: turn, ...options });

test('navigation waits for every observed handler and its terminal CDP ACK, not HTTP completion', async () => {
  const barrier = make();
  const firstAck = deferred(), secondAck = deferred(), httpResponse = deferred();
  const order = [];
  const first = barrier.trackPause(pause('one'), async () => { order.push('continue-one'); await firstAck.promise; });
  const second = barrier.trackPause(pause('two'), async () => { order.push('continue-two'); await secondAck.promise; });
  const navigation = barrier.beforeNavigate(() => { order.push('navigate'); return 'fresh-document'; });
  assert.equal(barrier.snapshot().pendingCount, 2);
  await turn();
  assert.deepEqual(order, ['continue-one', 'continue-two']);
  firstAck.resolve();
  await first;
  await turn();
  assert.equal(order.includes('navigate'), false);
  secondAck.resolve();
  await second;
  assert.equal(await navigation, 'fresh-document');
  assert.equal(order.at(-1), 'navigate');
  // No connection to HTTP completion exists; the request remains unresolved.
  assert.equal(await Promise.race([httpResponse.promise, Promise.resolve('still-pending')]), 'still-pending');
});

test('a policy await is registered synchronously, before a continuation is issued', async () => {
  const barrier = make();
  const policyRead = deferred(), ack = deferred();
  let commandSent = false, navigated = false;
  const handler = barrier.trackPause(pause('policy'), async () => {
    await policyRead.promise;
    commandSent = true;
    await ack.promise;
  });
  const navigation = barrier.beforeNavigate(() => { navigated = true; });
  assert.equal(barrier.snapshot().pendingCount, 1);
  await turn();
  assert.equal(commandSent, false);
  assert.equal(navigated, false);
  policyRead.resolve();
  await turn();
  assert.equal(commandSent, true);
  assert.equal(navigated, false);
  ack.resolve();
  await Promise.all([handler, navigation]);
  assert.equal(navigated, true);
});

test('a pause arriving during the fence is drained and requires another stable boundary', async () => {
  const fenceGate = deferred(), ack = deferred();
  let fences = 0, navigated = false;
  const barrier = make({ fence: async () => { if (++fences === 1) await fenceGate.promise; } });
  const navigation = barrier.beforeNavigate(() => { navigated = true; });
  await turn();
  const handler = barrier.trackPause(pause('queued-event'), () => ack.promise);
  fenceGate.resolve();
  await turn();
  assert.equal(navigated, false);
  ack.resolve();
  await Promise.all([handler, navigation]);
  assert.equal(fences, 2);
  assert.equal(navigated, true);
});

test('request pauses during Page.navigate are not queued behind navigation and do not deadlock', async () => {
  const barrier = make();
  const navigateStarted = deferred(), documentAck = deferred();
  const navigation = barrier.beforeNavigate(async () => {
    navigateStarted.resolve();
    await documentAck.promise;
    return 'ready';
  });
  await navigateStarted.promise;
  const documentHandler = barrier.trackPause(pause('document'), async (metadata) => {
    assert.equal(metadata.observedNavigationEpoch, 1);
    documentAck.resolve();
  });
  assert.equal(await navigation, 'ready');
  await documentHandler;
});

test('multiple navigation factories serialize through the fresh-document wrapper', async () => {
  const barrier = make();
  const firstStarted = deferred(), firstFresh = deferred();
  const order = [];
  const first = barrier.beforeNavigate(async () => {
    order.push('first-navigate'); firstStarted.resolve();
    await firstFresh.promise; order.push('first-fresh');
  });
  const second = barrier.beforeNavigate(() => { order.push('second-navigate'); });
  await firstStarted.promise;
  await turn();
  assert.deepEqual(order, ['first-navigate']);
  firstFresh.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first-navigate', 'first-fresh', 'second-navigate']);
  assert.equal(barrier.snapshot().observedNavigationEpoch, 2);
});

test('InvalidInterceptionId without networkId stays fatal for a prefetched GET', async () => {
  const barrier = make();
  const ack = deferred();
  const error = Object.assign(new Error('Invalid InterceptionId.'), { code: -32602 });
  const handler = barrier.trackPause(pause('interception-job-45.0', {
    request: { method: 'GET', url: 'http://127.0.0.1:3100/review', headers: { rsc: '1', 'next-router-prefetch': '1' } },
  }), () => ack.promise);
  let navigations = 0;
  const navigation = barrier.beforeNavigate(() => { navigations += 1; });
  const handlerFailure = assert.rejects(handler, (observed) => observed === error);
  const navigationFailure = assert.rejects(navigation, (observed) => observed === error);
  ack.reject(error);
  await Promise.all([handlerFailure, navigationFailure]);
  assert.equal(navigations, 0);
  assert.equal(barrier.snapshot().failed, true);
  await assert.rejects(barrier.beforeNavigate(() => { navigations += 1; }), (observed) => observed === error);
  assert.equal(navigations, 0);
});

test('deadline fails closed without forcing continuation, cancelling work, or dispatching navigation', async () => {
  const barrier = make({ timeoutMs: 20 });
  const ack = deferred();
  let navigations = 0, completions = 0;
  const handler = barrier.trackPause(pause('slow-ack'), async () => { await ack.promise; completions += 1; });
  await assert.rejects(barrier.beforeNavigate(() => { navigations += 1; }), { code: 'FETCH_DRAIN_TIMEOUT' });
  assert.equal(navigations, 0);
  assert.equal(completions, 0);
  assert.equal(barrier.snapshot().pendingCount, 1);
  ack.resolve();
  await handler;
  assert.equal(completions, 1);
  assert.equal(barrier.snapshot().failed, true);
});

test('duplicate active stage/id fails closed; the duplicate handler never runs', async () => {
  const barrier = make();
  const ack = deferred();
  const first = barrier.trackPause(pause('same'), () => ack.promise);
  let duplicateCalls = 0;
  await assert.rejects(barrier.trackPause(pause('same'), () => { duplicateCalls += 1; }), { code: 'FETCH_DUPLICATE_ACTIVE_PAUSE' });
  assert.equal(duplicateCalls, 0);
  await assert.rejects(barrier.beforeNavigate(() => {}), { code: 'FETCH_DUPLICATE_ACTIVE_PAUSE' });
  ack.resolve();
  await first;
});

test('Request and Response stages can share a fetchId without losing either ACK', async () => {
  const barrier = make();
  const requestAck = deferred(), responseAck = deferred();
  const request = barrier.trackPause(pause('same'), () => requestAck.promise);
  const response = barrier.trackPause(pause('same', { responseStatusCode: 204 }), () => responseAck.promise);
  let navigated = false;
  const navigation = barrier.beforeNavigate(() => { navigated = true; });
  assert.equal(barrier.snapshot().pendingCount, 2);
  requestAck.resolve();
  await request;
  await turn();
  assert.equal(navigated, false);
  responseAck.resolve();
  await Promise.all([response, navigation]);
  assert.equal(navigated, true);
});

test('safe trace records observed epoch and scalar hints without inventing network identity or leaking request data', () => {
  const secret = 'PRIVATE-CREDENTIAL-NEVER-TRACE';
  const metadata = safeFetchPauseMetadata({
    requestId: 'interception-job-48.0', frameId: 'FRAME-1',
    request: { method: 'GET', url: 'http://127.0.0.1:3100/vocabulary?secret=' + secret, postData: secret,
      headers: { Cookie: secret, Authorization: secret, referer: secret, 'next-url': secret, RSC: '1',
        'next-router-prefetch': '1', 'next-router-segment-prefetch': '/_tree', 'x-arbitrary': secret } },
  }, 3);
  assert.deepEqual(metadata, {
    fetchId: 'interception-job-48.0', stage: 'Request', frameId: 'FRAME-1', networkId: null,
    method: 'GET', observedNavigationEpoch: 3,
    headerHints: { rsc: '1', routerPrefetch: '1', segmentPrefetch: '/_tree' },
  });
  assert.equal(JSON.stringify(metadata).includes(secret), false);
  const malformed = safeFetchPauseMetadata({ requestId: 'unsafe value', networkId: secret + ' ', request: {
    method: secret, headers: { RSC: '1', rsc: '1', 'next-router-prefetch': secret, 'next-router-segment-prefetch': secret },
  } }, -1);
  assert.equal(malformed.fetchId, null);
  assert.equal(malformed.networkId, null);
  assert.equal(malformed.observedNavigationEpoch, null);
  assert.deepEqual(malformed.headerHints, { rsc: 'duplicate', routerPrefetch: 'other', segmentPrefetch: 'other' });
  assert.equal(JSON.stringify(malformed).includes(secret), false);
});


test('a late pause failure during navigation remains fatal without cancellation inference', async () => {
  const barrier = make();
  const started = deferred(), freshDocument = deferred();
  const navigation = barrier.beforeNavigate(async () => { started.resolve(); await freshDocument.promise; });
  await started.promise;
  const error = Object.assign(new Error('Invalid InterceptionId.'), { code: -32602 });
  await assert.rejects(barrier.trackPause(pause('late-no-network-id'), async () => { throw error; }), (observed) => observed === error);
  const rejection = assert.rejects(navigation, (observed) => observed === error);
  freshDocument.resolve();
  await rejection;
  assert.equal(barrier.snapshot().failed, true);
});
