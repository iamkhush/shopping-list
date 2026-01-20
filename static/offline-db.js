// IndexedDB storage module for offline persistence
class OfflineDB {
  constructor() {
    this.dbName = 'shopping-list-db';
    this.version = 1;
    this.db = null;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB init error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create 'items' object store
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('synced', 'synced', { unique: false });
          console.log('Created items object store');
        }

        // Create 'pendingChanges' object store
        if (!db.objectStoreNames.contains('pendingChanges')) {
          const changeStore = db.createObjectStore('pendingChanges', { keyPath: 'id', autoIncrement: true });
          changeStore.createIndex('timestamp', 'timestamp', { unique: false });
          changeStore.createIndex('status', 'status', { unique: false });
          console.log('Created pendingChanges object store');
        }
      };
    });
  }

  // Save items to IndexedDB
  async saveItems(items) {
    const transaction = this.db.transaction(['items'], 'readwrite');
    const store = transaction.objectStore('items');
    
    // Clear and repopulate
    await new Promise((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = resolve;
      clearRequest.onerror = reject;
    });

    for (const item of items) {
      await new Promise((resolve, reject) => {
        const request = store.add({ ...item, synced: true });
        request.onsuccess = resolve;
        request.onerror = reject;
      });
    }

    console.log('Items saved to IndexedDB:', items.length);
    return items.length;
  }

  // Get all items from IndexedDB
  async getItems() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['items'], 'readonly');
      const store = transaction.objectStore('items');
      const request = store.getAll();

      request.onsuccess = () => {
        console.log('Items retrieved from IndexedDB:', request.result.length);
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Add pending change
  async addPendingChange(type, item) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingChanges'], 'readwrite');
      const store = transaction.objectStore('pendingChanges');
      
      const change = {
        type, // 'add', 'update', 'delete'
        item,
        timestamp: Date.now(),
        status: 'pending' // 'pending', 'syncing', 'synced', 'failed'
      };

      const request = store.add(change);
      request.onsuccess = () => {
        console.log(`Pending change added: ${type}`, item);
        resolve(request.result); // returns the auto-generated id
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get all pending changes
  async getPendingChanges() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingChanges'], 'readonly');
      const store = transaction.objectStore('pendingChanges');
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        const changes = request.result.sort((a, b) => a.timestamp - b.timestamp);
        console.log('Pending changes retrieved:', changes.length);
        resolve(changes);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Update pending change status
  async updatePendingChangeStatus(changeId, status) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingChanges'], 'readwrite');
      const store = transaction.objectStore('pendingChanges');
      const request = store.get(changeId);

      request.onsuccess = () => {
        const change = request.result;
        if (change) {
          change.status = status;
          const updateRequest = store.put(change);
          updateRequest.onsuccess = () => {
            console.log(`Change ${changeId} status updated to: ${status}`);
            resolve(change);
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error(`Change ${changeId} not found`));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Delete pending change
  async deletePendingChange(changeId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingChanges'], 'readwrite');
      const store = transaction.objectStore('pendingChanges');
      const request = store.delete(changeId);

      request.onsuccess = () => {
        console.log(`Pending change deleted: ${changeId}`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clear all pending changes
  async clearPendingChanges() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingChanges'], 'readwrite');
      const store = transaction.objectStore('pendingChanges');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('All pending changes cleared');
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get pending change count
  async getPendingChangeCount() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingChanges'], 'readonly');
      const store = transaction.objectStore('pendingChanges');
      const index = store.index('status');
      const request = index.count('pending');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Global instance
const offlineDB = new OfflineDB();
