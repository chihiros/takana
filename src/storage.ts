const DB_NAME = 'aidlc-db';
const DB_VERSION = 1;
const STORE = 'msgs';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('byRoomTs', ['roomId', 'ts']);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addMessage(roomId: string, msg: any) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const id = `${roomId}:${msg.ts || Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  await reqAsPromise(store.put({ id, roomId, ...msg }));
  await pruneRoom(db, roomId, 200);
  await txComplete(tx);
}

export async function addMessages(roomId: string, msgs: any[]) {
  if (!msgs || !msgs.length) return;
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  for (const m of msgs) {
    const id = `${roomId}:${m.ts || Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
    await reqAsPromise(store.put({ id, roomId, ...m }));
  }
  await pruneRoom(db, roomId, 200);
  await txComplete(tx);
}

export async function getMessages(roomId: string, limit = 200) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const idx = store.index('byRoomTs');
  const range = IDBKeyRange.bound([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER]);
  const out: any[] = [];
  await new Promise<void>((resolve, reject) => {
    const cursorReq = idx.openCursor(range);
    cursorReq.onsuccess = () => {
      const cur = cursorReq.result as IDBCursorWithValue | null;
      if (cur) { out.push(cur.value); cur.continue(); } else { resolve(); }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  await txComplete(tx);
  return out.slice(-limit);
}

async function pruneRoom(db: IDBDatabase, roomId: string, keep = 200) {
  const tx = db.transaction(STORE, 'readwrite');
  const idx = tx.objectStore(STORE).index('byRoomTs');
  const range = IDBKeyRange.bound([roomId, 0], [roomId, Number.MAX_SAFE_INTEGER]);
  const keys: IDBValidKey[] = [];
  await new Promise<void>((resolve, reject) => {
    const cursorReq = idx.openKeyCursor(range);
    cursorReq.onsuccess = () => {
      const cur = cursorReq.result as IDBCursor | null;
      if (cur) { keys.push(cur.primaryKey); cur.continue(); } else { resolve(); }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  const excess = keys.length - keep;
  if (excess > 0) {
    const store = tx.objectStore(STORE);
    for (let i = 0; i < excess; i++) await reqAsPromise(store.delete(keys[i]));
  }
  await txComplete(tx);
}

function reqAsPromise<T = any>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txComplete(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

