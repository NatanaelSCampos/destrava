/** Atomic string snapshots. A request success is not a committed transaction. */
export type StudySyncDurableStore = {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  initialize(key: string, value: string): Promise<string>;
};

export function indexedDbStudySyncStore(factory: IDBFactory): StudySyncDurableStore {
  let connection: Promise<IDBDatabase> | null = null;
  const open = () => {
    if (connection) return connection;
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      let rejected = false;
      const request = factory.open("destrava-study-sync", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("snapshots"))
          request.result.createObjectStore("snapshots");
      };
      request.onerror = () => { rejected = true; reject(request.error ?? new Error("Local progress storage unavailable")); };
      request.onblocked = () => { rejected = true; reject(new Error("Local progress storage blocked")); };
      request.onsuccess = () => {
        const db = request.result;
        if (rejected) { db.close(); return; }
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
    });
    connection = pending;
    void pending.catch(() => { if (connection === pending) connection = null; });
    return pending;
  };
  const transaction = async <T>(
    mode: IDBTransactionMode,
    act: (store: IDBObjectStore, result: (value: T) => void) => void,
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      let value: T;
      let tx: IDBTransaction;
      try { tx = db.transaction("snapshots", mode); }
      catch (error) { connection = null; reject(error); return; }
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error ?? new Error("Local progress transaction aborted"));
      tx.onerror = () => reject(tx.error ?? new Error("Local progress transaction failed"));
      try { act(tx.objectStore("snapshots"), result => { value = result; }); }
      catch (error) { try { tx.abort(); } catch { /* Already inactive. */ } reject(error); }
    });
  };
  return {
    read: key => transaction<string | null>("readonly", (store, result) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result !== undefined && typeof request.result !== "string") {
          // Abort the transaction rather than accepting an unknown stored format.
          store.transaction.abort();
          return;
        }
        result(request.result ?? null);
      };
    }),
    write: (key, value) => transaction<void>("readwrite", store => { store.put(value, key); }),
    initialize: (key, value) => transaction<string>("readwrite", (store, result) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result !== undefined) {
          if (typeof request.result !== "string") { store.transaction.abort(); return; }
          result(request.result);
        } else {
          store.put(value, key);
          result(value);
        }
      };
    }),
  };
}
