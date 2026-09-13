// One-command reproduction. Run with: npm run repro
//
// Three bugs in the AI SDK's experimental realtime stack, each measured
// independently so each can be cited on its own:
//
//   1. BrowserRealtimeTransport.connect() guards two of its four socket
//      handlers. onopen and onclose test `this.ws === ws`; onmessage and
//      onerror do not, so a socket the transport has already retired still
//      writes onto the live session.
//   2. ws.onclose takes no arguments, so a close code and reason never reach
//      any consumer. 1007 "invalid argument" reads as a clean hangup.
//   3. @ai-sdk/google serializes a non-object tool result straight into
//      FunctionResponse.response, which Gemini types as a protobuf Struct.
//
// No network, no API key, no browser. globalThis.WebSocket, globalThis.fetch
// and globalThis.AudioContext are replaced with the smallest fakes the real
// SDK code will accept, and everything else -- the transport, the reducer, the
// session, the Google provider -- is the genuinely installed package.
//
// Both the version this was hit on and the newest published version are
// measured, side by side in one process, through npm aliases in package.json.
// It exits non-zero if any of the three stops reproducing.
import { readFileSync } from 'node:fs'

// ── The fakes ───────────────────────────────────────────────────────────────

// Every socket the transport constructs, in order. Index 0 is the first
// connect()'s socket, index 1 the second's.
let sockets = []

// The transport reads `WebSocket.OPEN` off the global to gate sendRaw, assigns
// onopen/onmessage/onerror/onclose, and calls close(). Nothing else.
//
// close() deliberately does NOT fire onclose. A browser fires it later, on a
// task of its own, and the transport's `this.ws === ws` guard exists precisely
// because of that gap. Firing close events explicitly is what makes the gap
// observable.
class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url, protocols) {
    this.url = url
    this.protocols = protocols
    // Open immediately. There is no handshake to model; `onopen` is fired by
    // the scenario when it wants the transport to see one.
    this.readyState = FakeWebSocket.OPEN
    this.sent = []
    this.closed = false
    sockets.push(this)
  }

  send(data) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
    this.readyState = FakeWebSocket.CLOSED
  }
}

// AbstractRealtimeSession.connect() calls audio.ensurePlaybackContext() before
// it touches the socket, and dispose() calls close() on whatever that made.
// No audio frames are sent anywhere in this repro, so nothing else is reached.
class FakeAudioContext {
  constructor(options) {
    this.sampleRate = options?.sampleRate ?? 48000
    this.currentTime = 0
    this.destination = {}
  }

  close() {}
}

// The session POSTs this to get a token and a URL. The URL is never dialled --
// FakeWebSocket just records it.
const TOKEN_ENDPOINT_RESPONSE = {
  token: 'fake-token-not-a-real-one',
  url: 'wss://repro.invalid/live',
  tools: [],
}

globalThis.WebSocket = FakeWebSocket
globalThis.AudioContext = FakeAudioContext
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => TOKEN_ENDPOINT_RESPONSE,
})

// ── Harness ─────────────────────────────────────────────────────────────────

// sendEvent() runs through a promise chain, and handleMessage() is async, so
// every hand-fired handler needs the microtask queue drained before its effect
// is readable. A macrotask hop drains it whole.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

// Read off disk rather than through import: `ai` does not export its own
// package.json, and an alias has to be read by its alias name anyway.
const installed = (name) =>
  JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).version

const frame = (payload) => ({ data: JSON.stringify(payload) })

const SETUP_COMPLETE = frame({ setupComplete: {} })
const textFrame = (text) => frame({ serverContent: { modelTurn: { parts: [{ text }] } } })
const toolCallFrame = (id, name, args = {}) => frame({ toolCall: { functionCalls: [{ id, name, args }] } })

// AbstractRealtimeSession is abstract on one method: setState, the seam a UI
// binding implements. Implementing it as a log is exactly what a Vue ref or a
// React useState would do, and it is the only way the session's state is meant
// to be observed from outside.
function openSession(ai, model, { toolResult } = {}) {
  const log = { setState: [], errors: [], events: [], toolCalls: [] }

  class LoggingSession extends ai.Experimental_AbstractRealtimeSession {
    setState(key, value) {
      log.setState.push({ key, value })
    }
  }

  const session = new LoggingSession({
    model,
    api: { token: 'https://repro.invalid/api/realtime-token' },
    onError: (error) => log.errors.push(error.message),
    onEvent: (event) => log.events.push(event),
    onToolCall: ({ toolCall }) => {
      log.toolCalls.push(toolCall)
      return toolResult
    },
  })

  log.status = () => log.setState.filter((e) => e.key === 'status').at(-1)?.value
  log.transcript = () =>
    (log.setState.filter((e) => e.key === 'messages').at(-1)?.value ?? [])
      .flatMap((m) => m.parts ?? [])
      .map((p) => p.text ?? '')
      .join(' ')

  return { session, log }
}

// Connect, hand the transport an open socket, and let the provider confirm the
// session. Leaves the session in `connected`.
async function connectAndSettle(session) {
  await session.connect()
  const socket = sockets.at(-1)
  socket.onopen()
  await flush()
  socket.onmessage(SETUP_COMPLETE)
  await flush()
  return socket
}

// ── Bug 1: two of four handlers are guarded ───────────────────────────────

// A retired socket is one the transport is no longer tracking, either because
// a later connect() replaced it or because dispose()/disconnect() set
// `this.ws` to null. Both are measured; `retireBy` picks which.
async function measureRetiredSocket(ai, google, retireBy) {
  sockets = []
  const model = google.experimental_realtime('gemini-2.0-flash-live-001')
  const { session, log } = openSession(ai, model, { toolResult: { status: 'from a retired socket' } })

  const retired = await connectAndSettle(session)

  let live = null
  if (retireBy === 'reconnect') live = await connectAndSettle(session)
  else session.dispose()
  await flush()

  const statusBefore = log.status()
  const marker = log.setState.length

  // Handler 1 of 2 that IS guarded. A browser fires onclose on every socket it
  // closes, including the one connect() just replaced, so this path runs in
  // real life on every reconnect -- and correctly does nothing.
  retired.onclose({ code: 1006, reason: 'retired socket', wasClean: false })
  await flush()
  const closeIgnored = log.setState.length === marker && log.status() === statusBefore

  // Handler 1 of 2 that is NOT guarded.
  retired.onerror(new Error('ignored -- the transport constructs its own'))
  await flush()
  const errorApplied = log.status()

  // Handler 2 of 2 that is NOT guarded: the full dispatch chain runs --
  // handleMessage -> onServerEvent -> reduceServerEvent -> applyState + onEvent
  // + handleReducerEffect.
  const GHOST = 'spoken by a socket the transport retired'
  retired.onmessage(textFrame(GHOST))
  await flush()
  const textApplied = log.transcript().includes(GHOST)

  // The worst of it: a reducer effect. The retired socket's tool call reaches
  // the application's own onToolCall handler, and the output it returns is
  // written to whatever socket is live now.
  retired.onmessage(toolCallFrame('ghost-call-1', 'search'))
  await flush()
  const toolCallApplied = log.toolCalls.some((c) => c.toolCallId === 'ghost-call-1')
  const outputWentToLiveSocket =
    live != null && live.sent.some((d) => String(d).includes('ghost-call-1'))

  return {
    retireBy,
    statusBefore,
    closeIgnored,
    errorApplied,
    statusAfterError: log.status(),
    textApplied,
    toolCallApplied,
    outputWentToLiveSocket,
    sourceHasDisposedFlag: /disposed/.test(readFileSync(`node_modules/${ai.__name}/dist/index.js`, 'utf8')),
  }
}

// ── Bug 2: the CloseEvent is discarded ────────────────────────────────────

async function measureCloseEvent(ai, google) {
  sockets = []
  const model = google.experimental_realtime('gemini-2.0-flash-live-001')
  const { session, log } = openSession(ai, model)
  const socket = await connectAndSettle(session)

  // What the handler the transport installed actually declares. `() => {...}`
  // reports 0, so no CloseEvent can be read even in principle.
  const handlerArity = socket.onclose.length

  const CODE = 1007
  const REASON = 'Request contains an invalid argument'
  socket.onclose({ code: CODE, reason: REASON, wasClean: false })
  await flush()

  // Everything the session let out: state writes, onEvent, onError. If the
  // code or reason reached a consumer at all, it is in here.
  const observable = JSON.stringify({
    setState: log.setState,
    events: log.events,
    errors: log.errors,
  })

  return {
    handlerArity,
    status: log.status(),
    errorsRaised: log.errors,
    codeObservable: observable.includes(String(CODE)),
    reasonObservable: observable.includes(REASON),
  }
}

// ── Bug 3: a non-object lands in FunctionResponse.response ────────────────

const responseOf = (frame) => frame?.toolResponse?.functionResponses?.[0]?.response

// The public path: the model returned by provider.experimental_realtime().
// serializeClientEvent is part of RealtimeModelV4, which is what the transport
// itself calls.
async function measureSerialization(google) {
  const model = google.experimental_realtime('gemini-2.0-flash-live-001')
  const emit = (output) =>
    model.serializeClientEvent({
      type: 'conversation-item-create',
      item: { type: 'function-call-output', callId: 'call-1', name: 'search', output },
    })

  // `output` is documented as "JSON string containing the function call
  // result". All three of these are valid JSON strings.
  const string = await emit(JSON.stringify('SEARCH_UNAVAILABLE'))
  const number = await emit(JSON.stringify(42))
  const array = await emit(JSON.stringify(['a', 'b']))
  const object = await emit(JSON.stringify({ status: 'SEARCH_UNAVAILABLE' }))
  const invalid = await emit('not json at all')

  return {
    string: responseOf(string),
    number: responseOf(number),
    array: responseOf(array),
    object: responseOf(object),
    invalid: responseOf(invalid),
    invalidRaisedNothing: invalid != null,
  }
}

// The same thing reached the way an application reaches it: a tool call comes
// in, onToolCall returns a string, and the bytes handed to WebSocket.send()
// are read back. No SDK internals are touched.
async function measureWireFrame(ai, google) {
  sockets = []
  const model = google.experimental_realtime('gemini-2.0-flash-live-001')
  const { session } = openSession(ai, model, { toolResult: 'SEARCH_UNAVAILABLE' })
  const socket = await connectAndSettle(session)

  socket.onmessage(toolCallFrame('call-1', 'search'))
  await flush()

  const wire = socket.sent.map(String).find((d) => d.includes('toolResponse'))
  return { wire, response: responseOf(wire == null ? null : JSON.parse(wire)) }
}

// ── Run both version pairs ──────────────────────────────────────────────────

const PAIRS = [
  { label: 'hit on', ai: 'ai', google: '@ai-sdk/google' },
  { label: 'newest', ai: 'ai-latest', google: '@ai-sdk/google-latest' },
]

const results = []
for (const pair of PAIRS) {
  const ai = { ...(await import(pair.ai)), __name: pair.ai }
  const google = (await import(pair.google)).createGoogleGenerativeAI({
    apiKey: 'not-a-real-key-nothing-is-dialled',
  })

  results.push({
    label: pair.label,
    versions: { ai: installed(pair.ai), google: installed(pair.google) },
    reconnect: await measureRetiredSocket(ai, google, 'reconnect'),
    disposed: await measureRetiredSocket(ai, google, 'dispose'),
    close: await measureCloseEvent(ai, google),
    serialization: await measureSerialization(google),
    wire: await measureWireFrame(ai, google),
  })
}

// ── Report ──────────────────────────────────────────────────────────────────

const show = (v) => (typeof v === 'object' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v))

console.log('=============== RESULT ===============')
console.log(`node : ${process.version}`)

const assertions = []

for (const r of results) {
  const { reconnect, disposed, close, serialization, wire } = r
  console.log('--------------------------------------')
  console.log(`${r.label}: ai@${r.versions.ai} + @ai-sdk/google@${r.versions.google}`)
  console.log('')
  console.log('  BUG 1  retired socket still drives the live session')
  console.log(`    "disposed" appears in ai/dist/index.js   : ${reconnect.sourceHasDisposedFlag ? 'yes' : 'no'}`)
  for (const m of [reconnect, disposed]) {
    const how = m.retireBy === 'reconnect' ? 'retired by a later connect()' : 'retired by dispose()'
    console.log(`    ${how}`)
    console.log(`      status before firing its handlers    : ${m.statusBefore}`)
    console.log(`      onclose  (guarded)   ignored it      : ${m.closeIgnored}`)
    console.log(`      onerror  (unguarded) set status      : ${m.statusAfterError}`)
    console.log(`      onmessage(unguarded) added its text  : ${m.textApplied}`)
    console.log(`      onmessage(unguarded) ran onToolCall  : ${m.toolCallApplied}`)
    if (m.retireBy === 'reconnect')
      console.log(`      that output written to live socket   : ${m.outputWentToLiveSocket}`)
  }
  console.log('')
  console.log('  BUG 2  the CloseEvent is discarded')
  console.log(`    arity of the installed ws.onclose        : ${close.handlerArity}`)
  console.log(`    close(1007, "Request contains an invalid argument")`)
  console.log(`      status reported                        : ${close.status}`)
  console.log(`      onError calls                          : ${close.errorsRaised.length ? close.errorsRaised.join('; ') : '(none)'}`)
  console.log(`      code 1007 anywhere observable          : ${close.codeObservable}`)
  console.log(`      reason anywhere observable             : ${close.reasonObservable}`)
  console.log('')
  console.log('  BUG 3  FunctionResponse.response is not always an object')
  console.log(`    output '"SEARCH_UNAVAILABLE"'  -> response: ${show(serialization.string)}`)
  console.log(`    output '42'                    -> response: ${show(serialization.number)}`)
  console.log(`    output '["a","b"]'             -> response: ${show(serialization.array)}`)
  console.log(`    output '{"status":"..."}'      -> response: ${show(serialization.object)}`)
  console.log(`    output 'not json at all'       -> response: ${show(serialization.invalid)}  (threw nothing: ${serialization.invalidRaisedNothing})`)
  console.log(`    frame handed to WebSocket.send():`)
  console.log(`      ${wire.wire}`)

  const tag = `ai@${r.versions.ai} + @ai-sdk/google@${r.versions.google}`
  assertions.push(
    [`BUG 1  ${tag}  onclose ignores a retired socket, onerror/onmessage do not`,
      reconnect.closeIgnored && disposed.closeIgnored
      && reconnect.statusAfterError === 'error' && disposed.statusAfterError === 'error'
      && reconnect.textApplied && disposed.textApplied
      && reconnect.toolCallApplied && disposed.toolCallApplied
      && reconnect.outputWentToLiveSocket
      && !reconnect.sourceHasDisposedFlag],
    [`BUG 2  ${tag}  close code 1007 and its reason reach no consumer`,
      close.handlerArity === 0 && close.status === 'disconnected'
      && close.errorsRaised.length === 0
      && !close.codeObservable && !close.reasonObservable],
    [`BUG 3  ${tag}  a string tool result lands in response as a bare string`,
      serialization.string === 'SEARCH_UNAVAILABLE'
      && serialization.number === 42
      && Array.isArray(serialization.array)
      && typeof serialization.object === 'object' && !Array.isArray(serialization.object)
      && typeof serialization.invalid === 'object' && Object.keys(serialization.invalid).length === 0
      && wire.response === 'SEARCH_UNAVAILABLE'],
  )
}

console.log('--------------------------------------')
const width = Math.max(...assertions.map(([label]) => label.length))
for (const [label, ok] of assertions) console.log(`${label.padEnd(width)} : ${ok}`)
const reproduced = assertions.every(([, ok]) => ok)
console.log(`${'ALL THREE REPRODUCED ON BOTH VERSION PAIRS'.padEnd(width)} : ${reproduced}`)
console.log('======================================')

if (!reproduced) {
  console.log('\nDid NOT observe the expected outcome. See the per-version block above.')
  process.exit(1)
}
