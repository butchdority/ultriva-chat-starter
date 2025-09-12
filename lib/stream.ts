export function getEventStream() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<any>

  const readable = new ReadableStream({
    start(c) { controller = c },
    cancel() {}
  })

  function send(obj: any) {
    const data = `data: ${JSON.stringify(obj)}\n\n`
    controller.enqueue(encoder.encode(data))
  }
  function close() { controller.close() }
  return { readable, push: send, close }
}
