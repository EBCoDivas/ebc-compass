import { EventStreamCodec } from '@smithy/core/event-streams'
const encoder = new TextEncoder()
const codec = new EventStreamCodec(bytes => new TextDecoder().decode(bytes), text => encoder.encode(text))

/** Frames AWS EventStream con CRC; los consume el SDK real de Bedrock. */
export function bedrockEvent(type: string, value: unknown, exception = false): Uint8Array {
  return codec.encode({
    headers: {
      ':message-type': { type: 'string', value: exception ? 'exception' : 'event' },
      [exception ? ':exception-type' : ':event-type']: { type: 'string', value: type },
      ':content-type': { type: 'string', value: 'application/json' },
    },
    body: encoder.encode(JSON.stringify(value)),
  })
}
