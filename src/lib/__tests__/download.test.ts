// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { openResumableStream } from '../download';

/**
 * Exercises the retry / resume behaviour of the resumable download stream
 * against a scripted `fetch`. All timing goes through an injected `sleep`, so
 * the suite never actually waits for the backoff delays.
 */

const bytes = (...values: number[]) => new Uint8Array(values);

/**
 * A body that emits `chunks` and then either closes or errors.
 *
 * Pull-based on purpose: erroring synchronously in `start()` poisons the
 * whole stream before Response has read the queued chunks (undici discards
 * them), which is not how a real network body dies mid-transfer.
 */
function makeBody(chunks: Uint8Array[], failWith?: Error): ReadableStream<Uint8Array> {
  let next = 0;
  return new ReadableStream({
    pull(controller) {
      if (next < chunks.length) {
        controller.enqueue(chunks[next++]);
        return;
      }
      if (failWith) controller.error(failWith);
      else controller.close();
    },
  });
}

function makeResponse(
  chunks: Uint8Array[],
  {
    status = 200,
    headers = {},
    failWith,
  }: { status?: number; headers?: Record<string, string>; failWith?: Error } = {}
): Response {
  return new Response(makeBody(chunks, failWith), { status, headers });
}

/** Drains the stream into one buffer. */
async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

const instantSleep = () => {
  const delays: number[] = [];
  const sleep = (ms: number) => {
    delays.push(ms);
    return Promise.resolve();
  };
  return { delays, sleep };
};

describe('openResumableStream', () => {
  it('streams a plain successful download and reports cumulative progress', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeResponse([bytes(1, 2), bytes(3, 4, 5)], { headers: { 'content-length': '5' } })
    );
    const progress: Array<[number, number]> = [];

    const { stream, total } = await openResumableStream('https://x/db.gz', {
      fetchImpl: fetchImpl as any,
      onProgress: (loaded, t) => progress.push([loaded, t]),
    });

    expect(total).toBe(5);
    expect(await collect(stream)).toEqual(bytes(1, 2, 3, 4, 5));
    expect(progress).toEqual([[2, 5], [5, 5]]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries the initial request with exponential backoff', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(makeResponse([], { status: 503 }))
      .mockResolvedValueOnce(makeResponse([bytes(9)], { headers: { 'content-length': '1' } }));
    const { delays, sleep } = instantSleep();

    const { stream } = await openResumableStream('https://x/db.gz', {
      fetchImpl: fetchImpl as any,
      baseDelayMs: 100,
      sleep,
    });

    expect(await collect(stream)).toEqual(bytes(9));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // 1× then 2× the base delay — one sleep before each retry.
    expect(delays).toEqual([100, 200]);
  });

  it('gives up opening after maxAttempts and names the last failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse([], { status: 500 }));
    const { sleep } = instantSleep();

    await expect(
      openResumableStream('https://x/db.gz', { fetchImpl: fetchImpl as any, maxAttempts: 3, sleep })
    ).rejects.toThrow('failed after 3 attempts (HTTP 500)');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('resumes with a Range request after a mid-stream error', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse([bytes(1, 2)], {
          headers: { 'content-length': '5', 'accept-ranges': 'bytes' },
          failWith: new TypeError('network reset'),
        })
      )
      .mockResolvedValueOnce(
        makeResponse([bytes(3, 4, 5)], {
          status: 206,
          headers: { 'content-range': 'bytes 2-4/5' },
        })
      );
    const { sleep } = instantSleep();
    const progress: number[] = [];

    const { stream } = await openResumableStream('https://x/db.gz', {
      fetchImpl: fetchImpl as any,
      sleep,
      onProgress: (loaded) => progress.push(loaded),
    });

    expect(await collect(stream)).toEqual(bytes(1, 2, 3, 4, 5));
    // The resume request asked for the exact byte where the stream died.
    const resumeHeaders = fetchImpl.mock.calls[1][1].headers;
    expect(resumeHeaders['Range']).toBe('bytes=2-');
    // Progress keeps growing across the resume instead of restarting at 0.
    expect(progress).toEqual([2, 5]);
  });

  it('treats a connection closed before Content-Length as a failure and resumes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        // The body closes cleanly after 2 of 4 bytes — fetch reports EOF, not
        // an error, which used to truncate the database silently.
        makeResponse([bytes(1, 2)], {
          headers: { 'content-length': '4', 'accept-ranges': 'bytes' },
        })
      )
      .mockResolvedValueOnce(
        makeResponse([bytes(3, 4)], { status: 206, headers: { 'content-range': 'bytes 2-3/4' } })
      );
    const { sleep } = instantSleep();

    const { stream } = await openResumableStream('https://x/db.gz', {
      fetchImpl: fetchImpl as any,
      sleep,
    });

    expect(await collect(stream)).toEqual(bytes(1, 2, 3, 4));
  });

  it('skips already-received bytes when the server ignores the Range', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse([bytes(1, 2)], {
          headers: { 'content-length': '4', 'accept-ranges': 'bytes' },
          failWith: new TypeError('reset'),
        })
      )
      // 200 with the full body again: the 2 bytes already delivered must not
      // be emitted twice or the gzip stream would be corrupt.
      .mockResolvedValueOnce(makeResponse([bytes(1), bytes(2, 3), bytes(4)], { status: 200 }));
    const { sleep } = instantSleep();

    const { stream } = await openResumableStream('https://x/db.gz', {
      fetchImpl: fetchImpl as any,
      sleep,
    });

    expect(await collect(stream)).toEqual(bytes(1, 2, 3, 4));
  });

  it('re-fetches from scratch when the server does not support ranges', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse([bytes(1, 2)], {
          headers: { 'content-length': '3' }, // no accept-ranges
          failWith: new TypeError('reset'),
        })
      )
      .mockResolvedValueOnce(makeResponse([bytes(1, 2, 3)]));
    const { sleep } = instantSleep();

    const { stream } = await openResumableStream('https://x/db.gz', {
      fetchImpl: fetchImpl as any,
      sleep,
    });

    expect(await collect(stream)).toEqual(bytes(1, 2, 3));
    // No Range header was sent, since the server never advertised support.
    expect(fetchImpl.mock.calls[1][1].headers['Range']).toBeUndefined();
  });

  it('refills the failure budget whenever data flows again', async () => {
    // maxAttempts=2 with two separate single hiccups: each stall consumes one
    // attempt, and the counter resets when a chunk arrives — a long flaky
    // download is not capped at 2 hiccups in total.
    const rangeHeaders = { 'content-length': '3', 'accept-ranges': 'bytes' };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse([bytes(1)], { headers: rangeHeaders, failWith: new TypeError('reset') })
      )
      .mockResolvedValueOnce(
        makeResponse([bytes(2)], {
          status: 206,
          headers: { 'content-range': 'bytes 1-2/3' },
          failWith: new TypeError('reset again'),
        })
      )
      .mockResolvedValueOnce(
        makeResponse([bytes(3)], { status: 206, headers: { 'content-range': 'bytes 2-2/3' } })
      );
    const { sleep } = instantSleep();

    const { stream } = await openResumableStream('https://x/db.gz', {
      fetchImpl: fetchImpl as any,
      maxAttempts: 2,
      sleep,
    });

    expect(await collect(stream)).toEqual(bytes(1, 2, 3));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('errors the stream once resume attempts are exhausted', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse([bytes(1)], {
          headers: { 'content-length': '3', 'accept-ranges': 'bytes' },
          failWith: new TypeError('reset'),
        })
      )
      .mockRejectedValue(new TypeError('still down'));
    const { sleep } = instantSleep();

    const { stream } = await openResumableStream('https://x/db.gz', {
      fetchImpl: fetchImpl as any,
      maxAttempts: 3,
      sleep,
    });

    await expect(collect(stream)).rejects.toThrow('failed after 3 attempts (still down)');
  });

  it('forwards custom headers on every request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse([bytes(1)], {
          headers: { 'content-length': '2', 'accept-ranges': 'bytes' },
          failWith: new TypeError('reset'),
        })
      )
      .mockResolvedValueOnce(
        makeResponse([bytes(2)], { status: 206, headers: { 'content-range': 'bytes 1-1/2' } })
      );
    const { sleep } = instantSleep();

    const { stream } = await openResumableStream('https://x/db.gz', {
      fetchImpl: fetchImpl as any,
      headers: { Accept: 'application/octet-stream' },
      sleep,
    });
    await collect(stream);

    for (const call of fetchImpl.mock.calls) {
      expect(call[1].headers['Accept']).toBe('application/octet-stream');
    }
  });
});
