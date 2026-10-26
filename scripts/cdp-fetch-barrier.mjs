// Harness coordination only. This module never admits, ignores, or retries requests.
const safeId = (value) => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,256}$/.test(value) ? value : null;

function headerHint(headers, name, allowed) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return null;
  const values = Object.entries(headers).filter(([key]) => key.toLowerCase() === name).map(([, value]) => value);
  if (!values.length) return null;
  if (values.length !== 1) return 'duplicate';
  return allowed.includes(values[0]) ? values[0] : 'other';
}

// No URL, body, cookie, authorization, referer, or arbitrary header value is retained.
// The epoch records when the pause was observed, not its originating document.
export function safeFetchPauseMetadata(params, observedNavigationEpoch) {
  return {
    fetchId: safeId(params?.requestId),
    stage: params?.responseStatusCode !== undefined || params?.responseErrorReason !== undefined ? 'Response' : 'Request',
    frameId: safeId(params?.frameId),
    networkId: safeId(params?.networkId),
    method: typeof params?.request?.method === 'string' && /^[A-Z]{1,16}$/.test(params.request.method) ? params.request.method : 'other',
    observedNavigationEpoch: Number.isSafeInteger(observedNavigationEpoch) && observedNavigationEpoch >= 0 ? observedNavigationEpoch : null,
    headerHints: {
      rsc: headerHint(params?.request?.headers, 'rsc', ['0', '1']),
      routerPrefetch: headerHint(params?.request?.headers, 'next-router-prefetch', ['1']),
      segmentPrefetch: headerHint(params?.request?.headers, 'next-router-segment-prefetch', ['/_tree']),
    },
  };
}

function barrierError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function createFetchContinuationBarrier({
  timeoutMs = 5000,
  fence = async () => {},
  eventTurn = () => new Promise((resolve) => setTimeout(resolve, 0)),
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || typeof fence !== 'function' || typeof eventTurn !== 'function') {
    throw new TypeError('INVALID_FETCH_BARRIER_CONFIGURATION');
  }
  const active = new Map();
  let revision = 0;
  let observedNavigationEpoch = 0;
  let firstFailure = null;
  let navigationTail = Promise.resolve();
  let signalFailure;
  const failureSignal = new Promise((resolve) => { signalFailure = resolve; });

  function fail(error) {
    if (!firstFailure) {
      firstFailure = error instanceof Error ? error : barrierError('FETCH_HANDLER_FAILED');
      signalFailure();
    }
    return firstFailure;
  }
  function assertHealthy() {
    if (firstFailure) throw firstFailure;
  }
  function rejected(error) {
    const promise = Promise.reject(fail(error));
    // A browser event emitter may not await its listener; failure is also latched.
    void promise.catch(() => {});
    return promise;
  }

  function trackPause(params, handler) {
    const metadata = safeFetchPauseMetadata(params, observedNavigationEpoch);
    if (!metadata.fetchId || typeof handler !== 'function') return rejected(barrierError('INVALID_FETCH_PAUSE'));
    const key = metadata.stage + ':' + metadata.fetchId;
    if (active.has(key)) return rejected(barrierError('FETCH_DUPLICATE_ACTIVE_PAUSE'));
    // Registration happens before the handler's first await (or synchronous body).
    const record = { metadata, promise: null };
    active.set(key, record);
    revision += 1;
    record.promise = Promise.resolve().then(() => handler(metadata)).then(
      (result) => {
        active.delete(key);
        revision += 1;
        return result;
      },
      (error) => {
        active.delete(key);
        revision += 1;
        throw fail(error);
      },
    );
    void record.promise.catch(() => {});
    return record.promise;
  }

  async function drain() {
    assertHealthy();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(fail(barrierError('FETCH_DRAIN_TIMEOUT'))), timeoutMs);
    });
    const aborted = failureSignal.then(() => { throw firstFailure; });
    const bounded = (work) => Promise.race([work, deadline, aborted]);
    try {
      for (;;) {
        assertHealthy();
        const cohort = [...active.values()].map((record) => record.promise);
        await bounded(Promise.allSettled(cohort));
        assertHealthy();
        const settledRevision = revision;
        // A cheap CDP round trip and one event turn catch pauses already queued.
        // This does not wait for an HTTP response or for network idle.
        await bounded(Promise.resolve().then(fence));
        await bounded(Promise.resolve().then(eventTurn));
        assertHealthy();
        if (!active.size && settledRevision === revision) return;
      }
    } catch (error) {
      throw fail(error);
    } finally {
      clearTimeout(timer);
    }
  }

  function beforeNavigate(operation) {
    if (typeof operation !== 'function') return rejected(barrierError('INVALID_NAVIGATION_OPERATION'));
    const navigation = navigationTail.then(async () => {
      await drain();
      assertHealthy();
      observedNavigationEpoch += 1;
      // No await between the healthy/stable boundary and invoking Page.navigate.
      // Pauses during navigation run immediately; they must not wait behind it.
      const result = await operation({ observedNavigationEpoch });
      assertHealthy();
      return result;
    }).catch((error) => { throw fail(error); });
    navigationTail = navigation.catch(() => {});
    return navigation;
  }

  function snapshot() {
    return {
      observedNavigationEpoch,
      revision,
      pendingCount: active.size,
      failed: firstFailure !== null,
      active: [...active.values()].map(({ metadata }) => ({ ...metadata, headerHints: { ...metadata.headerHints } })),
    };
  }

  // handler MUST return/await the terminal continue/fail command's CDP ACK.
  return { trackPause, beforeNavigate, drain, snapshot };
}
