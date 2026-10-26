import type { ReviewState } from '../lib/chat-review';
import type { ChatMessage, ChatSource } from '../lib/chat-inspector';
export type SavedSession = { id: string; source: ChatSource; createdAt: string; count: number; complete: boolean; completedChunks: string[]; review?: ReviewState };
let connection: Promise<IDBDatabase> | undefined;
function db() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('smeb-chat-inspector', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('sessions', { keyPath: 'id' });
      req.result.createObjectStore('messages', { keyPath: ['sessionId', 'key'] }).createIndex('sessionId', 'sessionId');
    };
    req.onsuccess = () => resolve(req.result); req.onerror = () => { connection = undefined; reject(req.error); };
  });
  return connection;
}
export async function saveBatch(session: SavedSession, messages: ChatMessage[]) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['sessions', 'messages'], 'readwrite');
    tx.objectStore('sessions').put(session);
    for (const message of messages) tx.objectStore('messages').put({ ...message, sessionId: session.id });
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export async function savedSessions(): Promise<SavedSession[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database.transaction('sessions').objectStore('sessions').getAll();
    req.onsuccess = () => resolve((req.result as SavedSession[]).filter(s => s.source.type === 'vod').sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    req.onerror = () => reject(req.error);
  });
}
export async function savedMessages(id: string): Promise<ChatMessage[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const req = database.transaction('messages').objectStore('messages').index('sessionId').getAll(id);
    req.onsuccess = () => resolve((req.result as ChatMessage[]).sort((a, b) => a.seconds - b.seconds || a.key.localeCompare(b.key)));
    req.onerror = () => reject(req.error);
  });
}
export async function deleteSession(id: string) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction(['sessions', 'messages'], 'readwrite');
    tx.objectStore('sessions').delete(id);
    const req = tx.objectStore('messages').index('sessionId').openCursor(IDBKeyRange.only(id));
    req.onsuccess = () => { const cursor = req.result; if (cursor) { cursor.delete(); cursor.continue(); } };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
