import { PacketDecoder, liveMessage, makePacket, type ChatMessage, type ChatSource } from '../lib/chat-inspector';

export function collectLive(source: ChatSource, signal: AbortSignal, onMessages: (rows: ChatMessage[]) => void, onStatus: (text: string) => void, onError: (text: string) => void) {
  let socket: WebSocket | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0, sequence = 0, stopped = false;
  const started = Date.now();
  const sessionKey = crypto.randomUUID();
  function close() {
    stopped = true; clearInterval(heartbeat); clearTimeout(timeout); clearTimeout(reconnect);
    socket?.close();
  }
  signal.addEventListener('abort', close, { once: true });
  async function connect() {
    if (signal.aborted || stopped) return;
    try {
      let info = source;
      if (attempt > 0) {
        const res = await fetch(`/api/chat-inspector/source?url=${encodeURIComponent(source.url)}`, { signal });
        info = await res.json();
        if (!res.ok) throw new Error((info as unknown as { error: string }).error);
      }
      if (signal.aborted || stopped) return;
      const decoder = new PacketDecoder();
      const ws = new WebSocket(info.socketUrl!, 'chat'); socket = ws; ws.binaryType = 'arraybuffer';
      let joined = false;
      onStatus(attempt ? `연결 끊김 · 재연결 ${attempt}/5 (끊긴 동안의 채팅은 누락됩니다)` : '생방송 채팅에 연결 중…');
      timeout = setTimeout(() => { ws.close(); }, 12000);
      ws.onopen = () => { ws.send(makePacket('0001', '\x0c\x0c\x0c16\x0c')); };
      ws.onmessage = event => {
        try {
          const bytes = typeof event.data === 'string' ? new TextEncoder().encode(event.data) : new Uint8Array(event.data);
          const messages: ChatMessage[] = [];
          for (const packet of decoder.push(bytes)) {
            if (packet.code === '0001') ws.send(makePacket('0002', '\x0c' + info.chatNo + '\x0c'.repeat(5)));
            if (packet.code === '0002') {
              joined = true; clearTimeout(timeout);
              onStatus(attempt ? '생방송 수집 중 · 재연결 전 누락 구간 있음' : '생방송 수집 중 · 이 탭을 열어 두세요');
              heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(makePacket('0000', '\x0c')); }, 20000);
            }
            // 0007 is SETBJSTAT, not a disconnect. Socket close + metadata checks handle stream end.
            const message = liveMessage(packet.code, packet.fields, `${sessionKey}:${sequence++}`, (Date.now() - started) / 1000, new Date().toISOString());
            if (message) messages.push(message);
          }
          if (messages.length) onMessages(messages);
        } catch (error) { close(); onError((error as Error).message); }
      };
      ws.onerror = () => { /* close event drives retry, including browser connection failures. */ };
      ws.onclose = () => {
        clearInterval(heartbeat); clearTimeout(timeout);
        if (stopped || signal.aborted) return;
        if (++attempt > 5) { close(); onError('생방송 연결에 실패했습니다. 방송 상태 또는 네트워크를 확인한 뒤 다시 시도해 주세요.'); return; }
        onStatus(joined ? '연결이 끊겼습니다. 재연결 중이며 이 구간의 채팅은 누락될 수 있습니다.' : '채팅 서버 연결을 다시 시도하고 있습니다…');
        reconnect = setTimeout(connect, Math.min(1000 * 2 ** attempt, 15000));
      };
    } catch (error) {
      if (!signal.aborted) { close(); onError((error as Error).message); }
    }
  }
  void connect();
  return close;
}
