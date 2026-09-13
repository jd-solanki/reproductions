# Repro: three bugs in the AI SDK's experimental realtime stack

`BrowserRealtimeTransport` guards two of the four handlers it puts on a socket.
A socket it has already retired still writes onto the live session through the
other two. Separately, the close code and reason never leave the transport, and
`@ai-sdk/google` puts non-objects into a protobuf `Struct` field.

All three reproduce on the newest published versions as well as the ones they
were hit on. Nothing is fixed upstream yet.

| | |
| --- | --- |
| `ai` | `7.0.97` (hit on) and `7.0.99` (newest) — both affected |
| `@ai-sdk/google` | `4.0.67` (hit on) and `4.0.69` (newest) — both affected |
| `zod` | 4.4.3 |
| `node` | v24.20.0 |

Those are resolved versions, printed by the run rather than copied from
`package.json`. Both pairs are installed side by side through npm aliases and
measured in one process, so the comparison is not a re-install between runs.

## Run it

```bash
npm install
npm run repro
```

Everything is in [`repro.mjs`](./repro.mjs). No network, no API key, no browser,
no dev server. `globalThis.WebSocket`, `globalThis.fetch` and
`globalThis.AudioContext` are replaced with the smallest fakes the real SDK
code accepts; the transport, the reducer, the session and the Google provider
are all the genuinely installed packages. It exits non-zero if any of the three
stops reproducing, so it doubles as a regression check. That was verified by
planting the guard from bug 1 into `node_modules/ai/dist/index.js` and watching
the run exit 1.

## Bug 1 — `onmessage` and `onerror` are not guarded; `onopen` and `onclose` are

`connect()` assigns four handlers. Two of them check that the socket is still
the one the transport is tracking. Two do not. From the shipped sourcemap, so
the comments are the author's:

```ts
// node_modules/ai/dist/index.js.map -> ../src/realtime/browser-realtime-transport.ts
connect({ token, url, onOpen }: { ... }): void {
  this.ws?.close();
  this.ws = null;

  const wsConfig = this.model.getWebSocketConfig({ token, url });
  const ws = new WebSocket(wsConfig.url, wsConfig.protocols);

  // Track the socket immediately (not just in `onopen`) so that calling
  // `disconnect()` while it is still connecting actually closes it. Otherwise
  // `close()` would be a no-op and the socket could open afterwards and fire
  // the `onOpen` (session-update) callback against a disconnected session.
  this.ws = ws;

  ws.onopen = () => {
    // Ignore a late open for a socket that has since been replaced/closed.
    if (this.ws !== ws) return;
    onOpen();
  };

  ws.onmessage = messageEvent => {
    void this.handleMessage(messageEvent);
  };

  ws.onerror = () => {
    this.onError(new Error('WebSocket connection error'));
  };

  ws.onclose = () => {
    if (this.ws === ws) {
      this.ws = null;
      this.onClose();
    }
  };
}
```

The comment on `onopen` states the hazard exactly — "a socket that has since
been replaced/closed" — and `onclose` is written against the same hazard. The
other two handlers on the same socket are not. There is no other line of
defence: `grep -c disposed node_modules/ai/dist/index.js` returns `0` on both
versions, and the run prints that.

Two ordinary things retire a socket:

- **`disconnect()` or `dispose()`**, which set `this.ws = null` and call
  `ws.close()`. A WebSocket does not go straight to `CLOSED` — it goes to
  `CLOSING` and keeps delivering frames that were already in flight, and a
  connection that was still handshaking fires `error`.
- **a later `connect()`**, which does `this.ws?.close(); this.ws = null;` and
  then immediately installs socket #2. Socket #1's `close` arrives on a later
  task, and anything buffered on it arrives with it.

What gets through, on the same session object, after the socket is retired:

```
ws.onerror   -> this.onError(...)                      // session-level
             -> applyState(reducer.setStatus(state, 'error'))
             -> options.onError(error)

ws.onmessage -> handleMessage -> onServerEvent
             -> handleServerEvent
                  applyState(reducer.reduceServerEvent(...))   // messages, events
                  options.onEvent(event)
                  handleReducerEffect(effect)                  // play-audio,
                                                               // speech-started,
                                                               // tool-call, error
```

`handleReducerEffect` is the sharp edge. A `tool-call` effect calls
`executeToolCall`, which calls the application's own `onToolCall`, and whatever
that returns goes through `addToolOutput` into `sendEvent` — onto whichever
socket is live *now*. The run shows a tool call arriving on retired socket #1
producing a `toolResponse` frame written to socket #2.

### Symptom

A session that has just reconnected successfully reports `status: 'error'`
because the socket it replaced errored out. A session that was disposed reports
`'error'` too, and grows messages, after it was disposed. Tool handlers run for
a connection nobody is listening to.

The contrast is the evidence, so the run prints both: the same retired socket's
`onclose` is ignored, on both retirement paths, on both versions.

### Fix

The guard already in `onopen` and `onclose`, on all four:

```ts
ws.onmessage = messageEvent => {
  if (this.ws !== ws) return;
  void this.handleMessage(messageEvent);
};

ws.onerror = () => {
  if (this.ws !== ws) return;
  this.onError(new Error('WebSocket connection error'));
};
```

## Bug 2 — the `CloseEvent` is discarded, so a close code never reaches anyone

`onclose` takes no parameter, and the callback it forwards to takes none
either:

```ts
// node_modules/ai/dist/index.js.map -> ../src/realtime/browser-realtime-transport.ts
export type BrowserRealtimeTransportOptions = {
  model: RealtimeModel;
  onServerEvent: (event: RealtimeServerEvent) => void | Promise<void>;
  onError: (error: Error) => void;
  onClose: () => void;
};
```

```ts
ws.onclose = () => {
  if (this.ws === ws) {
    this.ws = null;
    this.onClose();
  }
};
```

The session's implementation of `onClose` is the whole of what a consumer gets:

```js
// node_modules/ai/dist/index.js, AbstractRealtimeSession constructor
onClose: () => {
  this.applyState(this.reducer.setStatus(this.state, "disconnected"));
}
```

So `code` and `reason` are dropped at the handler and there is no second path
they could take — `onError` is not called on close, and no server event is
synthesised.

### Symptom

Gemini Live kills a session with `1007 Request contains an invalid argument`
when it dislikes a frame — which is exactly what bug 3 produces. The
application sees `status: 'disconnected'` and nothing else. It is
indistinguishable from a clean hangup, an idle timeout, or the user closing the
tab, so a retry loop reconnects and gets killed again with no way to learn why.

The run fires `{ code: 1007, reason: 'Request contains an invalid argument' }`,
serialises everything the session let out (every `setState`, every `onEvent`,
every `onError`) and greps it: neither the code nor the reason appears
anywhere. It also prints `Function.length` of the handler the transport
installed — `0` — so no `CloseEvent` can be read even in principle.

### Fix

Widen `onClose` to `(event: CloseEvent) => void`, pass it through, and put
`code`/`reason` somewhere observable.

## Bug 3 — `@ai-sdk/google` puts a non-object into `FunctionResponse.response`

The provider parses the tool output and uses the parsed value directly:

```ts
// node_modules/@ai-sdk/google/dist/index.js.map -> ../src/realtime/google-realtime-event-mapper.ts
async function serializeFunctionCallOutput(
  item: RealtimeModelV4FunctionCallOutput,
): Promise<unknown> {
  const parseResult = await safeParseJSON({ text: item.output });
  const response = parseResult.success ? parseResult.value : {};

  return {
    toolResponse: {
      functionResponses: [
        {
          id: item.callId,
          name: item.name,
          response,
        },
      ],
    },
  };
}
```

`item.output` is documented as a JSON string, not as a JSON *object*:

```ts
// node_modules/@ai-sdk/provider/dist/index.d.ts
type RealtimeModelV4FunctionCallOutput = {
    type: 'function-call-output';
    ...
    /**
     * JSON string containing the function call result.
     */
    output: string;
};
```

And Gemini requires an object there. From Google's own SDK:

```ts
// googleapis/js-genai, src/types.ts, interface FunctionResponse
/** Required. The function response in JSON object format. Use "output" key to specify function output and "error" key to specify error details (if any). If "output" and "error" keys are not specified, then whole "response" is treated as function output. */
response?: Record<string, unknown>;
```

`Record<string, unknown>`, because the field is a `google.protobuf.Struct`, and
ProtoJSON encodes a `Struct` as a JSON object and nothing else.

Nothing about this needs a contrived caller. The public API invites it:

```ts
// node_modules/ai/dist/index.d.ts
onToolCall?: (args: { toolCall: { ... } }) => Promise<unknown> | unknown | undefined;
addToolOutput(callId: string, result: unknown): void;
```

`unknown`, both times. And the reducer stringifies whatever it gets:

```js
// node_modules/ai/dist/index.js, RealtimeEventReducer
addToolOutput(state, callId, result) {
  return {
    state: this.updateToolPartState(state, callId, result),
    output: {
      callId,
      name: this.toolCallIdToName.get(callId),
      output: JSON.stringify(result)
    }
  };
}
```

So `return 'SEARCH_UNAVAILABLE'` from `onToolCall` becomes `'"SEARCH_UNAVAILABLE"'`,
which parses back to a bare string, which goes on the wire as one.

The same package gets this right on its non-realtime path, which is the
strongest argument that the realtime path is an oversight rather than a
decision. It always wraps:

```js
// node_modules/@ai-sdk/google/dist/index.js, appendToolResultParts
parts.push({
  functionResponse: {
    ...includeFunctionCallIds && toolCallId != null ? { id: toolCallId } : {},
    name: toolName,
    response: {
      name: toolName,
      content: responseTextParts.length > 0 ? responseTextParts.join("\n") : "Tool executed successfully."
    },
    ...functionResponseParts.length > 0 ? { parts: functionResponseParts } : {}
  }
});
```

### The second half: `: {}` swallows a parse failure

`parseResult.success ? parseResult.value : {}` means an output that is not valid
JSON becomes an empty object. No throw, no warning, no `onError`. The model is
told the tool returned nothing and answers as if it had.

### Symptom

`1007 Request contains an invalid argument`, and because of bug 2 the
application cannot see the code — it only sees the session drop. Or, on the
`: {}` path, no error at all and a model that quietly ignores the tool result.

### How the repro reaches it

Twice, both times through public API only, no internals touched:

1. `provider.experimental_realtime(modelId).serializeClientEvent(event)` —
   `serializeClientEvent` is part of `RealtimeModelV4` and is what the
   transport itself calls.
2. End to end: a `toolCall` frame arrives on the fake socket, `onToolCall`
   returns the string `'SEARCH_UNAVAILABLE'`, and the bytes handed to
   `WebSocket.send()` are read back.

### Fix

Wrap anything that is not a plain object, the way the non-realtime path does
and the way Google's own docstring says to:

```ts
const parsed = await safeParseJSON({ text: item.output });
const response =
  parsed.success && isPlainObject(parsed.value)
    ? parsed.value
    : { output: parsed.success ? parsed.value : item.output };
```

## Result

Real output from `npm run repro`. Full log in [`repro.log`](./repro.log).

```
=============== RESULT ===============
node : v24.20.0
--------------------------------------
hit on: ai@7.0.97 + @ai-sdk/google@4.0.67

  BUG 1  retired socket still drives the live session
    "disposed" appears in ai/dist/index.js   : no
    retired by a later connect()
      status before firing its handlers    : connected
      onclose  (guarded)   ignored it      : true
      onerror  (unguarded) set status      : error
      onmessage(unguarded) added its text  : true
      onmessage(unguarded) ran onToolCall  : true
      that output written to live socket   : true
    retired by dispose()
      status before firing its handlers    : disconnected
      onclose  (guarded)   ignored it      : true
      onerror  (unguarded) set status      : error
      onmessage(unguarded) added its text  : true
      onmessage(unguarded) ran onToolCall  : true

  BUG 2  the CloseEvent is discarded
    arity of the installed ws.onclose        : 0
    close(1007, "Request contains an invalid argument")
      status reported                        : disconnected
      onError calls                          : (none)
      code 1007 anywhere observable          : false
      reason anywhere observable             : false

  BUG 3  FunctionResponse.response is not always an object
    output '"SEARCH_UNAVAILABLE"'  -> response: "SEARCH_UNAVAILABLE"
    output '42'                    -> response: 42
    output '["a","b"]'             -> response: ["a","b"]
    output '{"status":"..."}'      -> response: {"status":"SEARCH_UNAVAILABLE"}
    output 'not json at all'       -> response: {}  (threw nothing: true)
    frame handed to WebSocket.send():
      {"toolResponse":{"functionResponses":[{"id":"call-1","name":"search","response":"SEARCH_UNAVAILABLE"}]}}
--------------------------------------
newest: ai@7.0.99 + @ai-sdk/google@4.0.69

  BUG 1  retired socket still drives the live session
    "disposed" appears in ai/dist/index.js   : no
    retired by a later connect()
      status before firing its handlers    : connected
      onclose  (guarded)   ignored it      : true
      onerror  (unguarded) set status      : error
      onmessage(unguarded) added its text  : true
      onmessage(unguarded) ran onToolCall  : true
      that output written to live socket   : true
    retired by dispose()
      status before firing its handlers    : disconnected
      onclose  (guarded)   ignored it      : true
      onerror  (unguarded) set status      : error
      onmessage(unguarded) added its text  : true
      onmessage(unguarded) ran onToolCall  : true

  BUG 2  the CloseEvent is discarded
    arity of the installed ws.onclose        : 0
    close(1007, "Request contains an invalid argument")
      status reported                        : disconnected
      onError calls                          : (none)
      code 1007 anywhere observable          : false
      reason anywhere observable             : false

  BUG 3  FunctionResponse.response is not always an object
    output '"SEARCH_UNAVAILABLE"'  -> response: "SEARCH_UNAVAILABLE"
    output '42'                    -> response: 42
    output '["a","b"]'             -> response: ["a","b"]
    output '{"status":"..."}'      -> response: {"status":"SEARCH_UNAVAILABLE"}
    output 'not json at all'       -> response: {}  (threw nothing: true)
    frame handed to WebSocket.send():
      {"toolResponse":{"functionResponses":[{"id":"call-1","name":"search","response":"SEARCH_UNAVAILABLE"}]}}
--------------------------------------
BUG 1  ai@7.0.97 + @ai-sdk/google@4.0.67  onclose ignores a retired socket, onerror/onmessage do not : true
BUG 2  ai@7.0.97 + @ai-sdk/google@4.0.67  close code 1007 and its reason reach no consumer           : true
BUG 3  ai@7.0.97 + @ai-sdk/google@4.0.67  a string tool result lands in response as a bare string    : true
BUG 1  ai@7.0.99 + @ai-sdk/google@4.0.69  onclose ignores a retired socket, onerror/onmessage do not : true
BUG 2  ai@7.0.99 + @ai-sdk/google@4.0.69  close code 1007 and its reason reach no consumer           : true
BUG 3  ai@7.0.99 + @ai-sdk/google@4.0.69  a string tool result lands in response as a bare string    : true
ALL THREE REPRODUCED ON BOTH VERSION PAIRS                                                           : true
======================================
```

## What the app is

There is no app. The realtime stack is reachable from Node as long as three
globals exist, so there is no framework, no build step and no page.

[`package.json`](./package.json) has `ai` and `@ai-sdk/google` twice each — once
at the version this was hit on, once aliased at the newest published version:

```json
"@ai-sdk/google": "4.0.67",
"@ai-sdk/google-latest": "npm:@ai-sdk/google@4.0.69",
"ai": "7.0.97",
"ai-latest": "npm:ai@7.0.99",
```

`repro.mjs` imports all four and runs the same three measurements against each
pair, so the per-version comparison happens in one process with no re-install.

The three fakes are the whole of the test double:

- **`WebSocket`** — records the URL, records what `send()` receives, and exposes
  the four handlers the transport assigns so they can be fired by hand. It
  reports `OPEN` from construction; there is no handshake to model.
- **`fetch`** — returns `{ token, url, tools: [] }` for the session's token
  endpoint. The URL is never dialled.
- **`AudioContext`** — `connect()` calls `ensurePlaybackContext()` and
  `dispose()` closes it. No audio frames are sent anywhere, so nothing else on
  it is reached.

`Experimental_AbstractRealtimeSession` is abstract on exactly one method,
`setState`, which is the seam a UI binding implements. The repro implements it
as a log, which is what a Vue `ref` or a React `useState` does, and it is the
only sanctioned way to observe the session's state from outside.

## Notes

- **`close()` does not fire `onclose` in the fake.** A browser fires it later,
  on a task of its own, and the `this.ws === ws` guard exists precisely because
  of that gap. Firing close events explicitly is what makes the gap observable;
  a fake that closed synchronously would hide the bug rather than show it.
- **Every hand-fired handler needs a macrotask before its effect is readable.**
  `sendEvent` runs through a promise chain and `handleMessage` is `async`.
- `onerror`'s argument is ignored by the transport — it constructs
  `new Error('WebSocket connection error')` itself. So the error an application
  sees never describes what happened, which is a smaller version of bug 2 and
  is not asserted separately.
- Bug 3 was reached through `provider.experimental_realtime(...)`, a fully
  public entry point, so no part of this repro reads a private field or copies
  a function out of the dist.
- Bugs 2 and 3 compound: bug 3 is a frame Gemini rejects with `1007`, and bug 2
  is why the application cannot see the `1007`. They are still separate fixes in
  separate packages.
