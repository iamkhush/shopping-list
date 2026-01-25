// API endpoints
const API_URL = 'https://chaddas.home/shopping-list/api';

// DOM Elements
const shoppingList = document.getElementById('shopping-list');
const searchInput = document.getElementById('newItem'); // Now used for search and add
const toggleFilterBtn = document.getElementById('toggleFilter');

// State
let showUncheckedOnly = false;
let currentItems = [];
let isOnline = navigator.onLine;
let pendingChangesData = [];
let currentSearchTerm = '';

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/shopping-list/sw.js', { scope: '/shopping-list/' }).then(registration => {
        console.log('Service Worker registered successfully:', registration);
    }).catch(error => {
        console.log('Service Worker registration failed:', error);
    });
}

// Network status detection
window.addEventListener('online', () => {
    console.log('App is now online');
    isOnline = true;
    updateConnectionStatus();
    showSyncButton();
});

window.addEventListener('offline', () => {
    console.log('App is now offline');
    isOnline = false;
    updateConnectionStatus();
});

function updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        if (isOnline) {
            statusElement.classList.remove('offline');
            statusElement.classList.add('online');
            statusElement.textContent = '🟢 Online';
        } else {
            statusElement.classList.remove('online');
            statusElement.classList.add('offline');
            statusElement.textContent = '🔴 Offline - Changes will be saved locally';
        }
    }
}

function showSyncButton() {
    const syncContainer = document.getElementById('sync-container');
    if (syncContainer) {
        // Show only if online and there are pending changes
        if (isOnline && pendingChangesData && pendingChangesData.length > 0) {
            syncContainer.style.display = 'block';
        } else {
            syncContainer.style.display = 'none';
        }
    }
}

// Load items when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await offlineDB.init();
    updateConnectionStatus();
    loadItems();
});
searchInput.addEventListener('input', handleSearch);
searchInput.addEventListener('keydown', handleSearchEnter);

// Enable drag and drop functionality
let draggedItem = null;

// Load all items from IndexedDB first, then sync with server
async function loadItems() {
    try {
        // Load from IndexedDB immediately (instant UI)
        const dbItems = await offlineDB.getItems();
        if (dbItems.length > 0) {
            currentItems = dbItems;
            renderItems(currentItems);
            console.log('Items loaded from IndexedDB');
        }

        // Fetch from server in background if online
        if (isOnline) {
            try {
                const response = await fetch(`${API_URL}/items`);
                if (response.ok) {
                    const serverItems = await response.json();
                    currentItems = serverItems;
                    await offlineDB.saveItems(serverItems);
                    renderItems(currentItems);
                    console.log('Items synced from server');
                }
            } catch (error) {
                console.warn('Failed to sync items from server, using local data:', error);
            }
        }

        // Load and display pending changes
        await loadPendingChanges();
    } catch (error) {
        console.error('Error loading items:', error);
    }
}

// Load pending changes from IndexedDB
async function loadPendingChanges() {
    try {
        pendingChangesData = await offlineDB.getPendingChanges();
        renderPendingChanges();
        showSyncButton();
    } catch (error) {
        console.error('Error loading pending changes:', error);
    }
}

// Toggle filter for unchecked items
function toggleUncheckedFilter() {
    showUncheckedOnly = !showUncheckedOnly;
    toggleFilterBtn.classList.toggle('active', showUncheckedOnly);
    toggleFilterBtn.textContent = showUncheckedOnly ? 'Show All Items' : 'Show Unchecked Only';
    renderItems();
}

// Render items in the list
function renderItems() {
    shoppingList.innerHTML = '';

    let itemsToRender = currentItems;

    // Apply search filter
    if (currentSearchTerm) {
        itemsToRender = itemsToRender.filter(item => item.name.toLowerCase().includes(currentSearchTerm));
    }

    const filteredItems = showUncheckedOnly ? itemsToRender.filter(item => !item.available) : itemsToRender;
    filteredItems.forEach(item => {
        const li = createItemElement(item);
        shoppingList.appendChild(li);
    });
}

// Create a new list item element
function createItemElement(item) {
    const li = document.createElement('li');
    li.className = 'shopping-item';
    if (item.available) {
        li.classList.add('completed');
    }

    // Add drag and drop attributes
    li.draggable = true;
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', handleDrop);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.available;
    checkbox.addEventListener('change', () => toggleItemStatus(item.id, checkbox.checked));

    const span = document.createElement('span');
    span.textContent = item.name;
    span.title = 'Double-click to edit'; // Add a tooltip
    span.addEventListener('dblclick', () => editItemName(item, span));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete item';
    deleteBtn.addEventListener('click', () => deleteItem(item.id, item.name));

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.title = 'Edit item';
    editBtn.addEventListener('click', () => editItemName(item, span));

    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);

    return li;
}

// Edit item name
function editItemName(item, span) {
    const oldName = item.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.className = 'edit-input';

    span.replaceWith(input);
    input.focus();

    const saveChanges = async () => {
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            try {
                if (isOnline) {
                    // Online: send to server
                    const response = await fetch(`${API_URL}/items/${item.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            name: newName,
                            available: item.available
                        })
                    });

                    if (response.ok) {
                        item.name = newName;
                        input.replaceWith(span);
                        span.textContent = newName;
                        await offlineDB.saveItems(currentItems);
                    } else {
                        const error = await response.text();
                        alert(`Error updating item: ${error}`);
                        input.replaceWith(span);
                    }
                } else {
                    // Offline: save locally and queue for sync
                    item.name = newName;
                    input.replaceWith(span);
                    span.textContent = newName;
                    await offlineDB.saveItems(currentItems);
                    await offlineDB.addPendingChange('update', item);
                    await loadPendingChanges();
                    console.log('Item name edited offline (pending)');
                }
            } catch (error) {
                console.error('Error updating item:', error);
                alert('Failed to update item');
                input.replaceWith(span);
            }
        } else {
            input.replaceWith(span);
        }
    };

    input.addEventListener('blur', saveChanges);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveChanges();
        } else if (e.key === 'Escape') {
            input.replaceWith(span);
        }
    });
}

// Handle real-time search
function handleSearch(e) {
    currentSearchTerm = e.target.value.toLowerCase();
    renderItems();
}

// Handle creating a new item on Enter if no search results
async function handleSearchEnter(e) {
    if (e.key !== 'Enter') {
        return;
    }

    const filteredCount = shoppingList.children.length;
    if (filteredCount === 0 && searchInput.value.trim() !== '') {
        await addNewItem();
    }
}

// Add a new item
async function addNewItem() {
    const name = searchInput.value.trim();
    if (!name) return;

    const newItem = { name: name, available: false };

    try {
        if (isOnline) {
            // Online: send to server
            const response = await fetch(`${API_URL}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newItem)
            });

            if (response.ok) {
                const addedItem = await response.json();
                currentItems.push(addedItem);
                await offlineDB.saveItems(currentItems);
                searchInput.value = '';
                currentSearchTerm = '';
                renderItems();
                console.log('Item added to server');
            } else {
                const error = await response.text();
                alert(error);
            }
        } else {
            // Offline: save locally with temporary ID
            const tempItem = { ...newItem, id: 'temp_' + Date.now() };
            currentItems.push(tempItem);
            await offlineDB.saveItems(currentItems);
            await offlineDB.addPendingChange('add', tempItem);
            searchInput.value = '';
            currentSearchTerm = '';
            renderItems();
            await loadPendingChanges();
            console.log('Item added offline (pending)');
        }
    } catch (error) {
        console.error('Error adding item:', error);
        if (!isOnline) {
            // Fallback: save offline even if something failed
            const tempItem = { ...newItem, id: 'temp_' + Date.now() };
            currentItems.push(tempItem);
            await offlineDB.saveItems(currentItems);
            await offlineDB.addPendingChange('add', tempItem);
            searchInput.value = '';
            currentSearchTerm = '';
            renderItems();
            await loadPendingChanges();
        } else {
            alert('Failed to add item');
        }
    }
}

// Toggle item status (available/unavailable)
async function toggleItemStatus(id, available) {
    try {
        const item = currentItems.find(item => item.id === id);
        if (!item) return;

        if (isOnline) {
            // Online: send to server
            const response = await fetch(`${API_URL}/items/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: item.name,
                    available: available
                })
            });

            if (response.ok) {
                currentItems[currentItems.findIndex(i => i.id === id)].available = available;
                await offlineDB.saveItems(currentItems);
                renderItems();
            }
        } else {
            // Offline: save locally and queue for sync
            currentItems[currentItems.findIndex(i => i.id === id)].available = available;
            await offlineDB.saveItems(currentItems);
            await offlineDB.addPendingChange('update', { ...item, available: available });
            renderItems();
            await loadPendingChanges();
            console.log('Item status updated offline (pending)');
        }
    } catch (error) {
        console.error('Error updating item:', error);
        if (!isOnline) {
            // Ensure offline changes are still saved
            const itemIndex = currentItems.findIndex(item => item.id === id);
            if (itemIndex !== -1) {
                currentItems[itemIndex].available = available;
                await offlineDB.saveItems(currentItems);
                await offlineDB.addPendingChange('update', currentItems[itemIndex]);
                renderItems();
                await loadPendingChanges();
            }
        }
    }
}

// Delete an item
async function deleteItem(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
        return;
    }

    try {
        const itemIndex = currentItems.findIndex(item => item.id === id);
        if (itemIndex === -1) return;

        const item = currentItems[itemIndex];

        if (isOnline) {
            // Online: send to server
            const response = await fetch(`${API_URL}/items/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                currentItems.splice(itemIndex, 1);
                await offlineDB.saveItems(currentItems);
                renderItems();
            } else {
                const error = await response.text();
                alert(error);
            }
        } else {
            // Offline: delete locally and queue for sync
            currentItems.splice(itemIndex, 1);
            await offlineDB.saveItems(currentItems);
            await offlineDB.addPendingChange('delete', item);
            renderItems();
            await loadPendingChanges();
            console.log('Item deleted offline (pending)');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        if (!isOnline) {
            // Fallback: ensure offline delete is still saved
            const itemIndex = currentItems.findIndex(item => item.id === id);
            if (itemIndex !== -1) {
                const item = currentItems[itemIndex];
                currentItems.splice(itemIndex, 1);
                await offlineDB.saveItems(currentItems);
                await offlineDB.addPendingChange('delete', item);
                renderItems();
                await loadPendingChanges();
            }
        } else {
            alert('Failed to delete item');
        }
    }
}

// Drag and Drop Handlers
function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    // Remove highlighting from all items
    document.querySelectorAll('.shopping-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    if (this === draggedItem) return;

    const rect = this.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
        this.classList.add('drag-over-top');
    } else {
        this.classList.add('drag-over-bottom');
    }
}

function handleDrop(e) {
    e.preventDefault();
    // Remove all drag-over classes
    document.querySelectorAll('.shopping-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    if (this === draggedItem) return;

    const items = Array.from(shoppingList.children);
    const draggedIndex = items.indexOf(draggedItem);
    const droppedIndex = items.indexOf(this);

    const rect = this.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
        this.parentNode.insertBefore(draggedItem, this);
    } else {
        this.parentNode.insertBefore(draggedItem, this.nextSibling);
    }
}

// Render pending changes section
function renderPendingChanges() {
    const pendingChangesContainer = document.getElementById('pending-changes-container');
    const pendingChangesList = document.getElementById('pending-changes-list');
    const pendingChangesCount = document.getElementById('pending-changes-count');

    if (!pendingChangesContainer || !pendingChangesList) return;

    if (pendingChangesData.length === 0) {
        pendingChangesContainer.style.display = 'none';
        return;
    }

    if (!isOnline) {
        pendingChangesContainer.style.display = 'block';
    }

    pendingChangesList.innerHTML = '';
    pendingChangesCount.textContent = pendingChangesData.length;

    pendingChangesData.forEach(change => {
        const li = document.createElement('li');
        li.className = `pending-item pending-${change.type}`;

        let icon = '';
        let action = '';

        switch (change.type) {
            case 'add':
                icon = '➕';
                action = 'Add';
                break;
            case 'update':
                icon = '✏️';
                action = 'Update';
                break;
            case 'delete':
                icon = '🗑️';
                action = 'Delete';
                break;
        }

        li.innerHTML = `
            <span class="pending-icon">${icon}</span>
            <span class="pending-text">${action}: <strong>${change.item.name}</strong></span>
            <span class="pending-status ${change.status}">${change.status}</span>
        `;

        pendingChangesList.appendChild(li);
    });
}

// Sync all pending changes to server
async function syncAllChanges() {
    if (!isOnline) {
        alert('You are offline. Please wait for connection before syncing.');
        return;
    }

    const syncBtn = document.getElementById('sync-all-btn');
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
    }

    let successCount = 0;
    let failureCount = 0;

    for (const change of pendingChangesData) {
        try {
            await offlineDB.updatePendingChangeStatus(change.id, 'syncing');

            let response;

            switch (change.type) {
                case 'add':
                    response = await fetch(`${API_URL}/items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: change.item.name,
                            available: change.item.available
                        })
                    });
                    break;

                case 'update':
                    response = await fetch(`${API_URL}/items/${change.item.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: change.item.name,
                            available: change.item.available
                        })
                    });
                    break;

                case 'delete':
                    response = await fetch(`${API_URL}/items/${change.item.id}`, {
                        method: 'DELETE'
                    });
                    break;
            }

            if (response && (response.ok || response.status === 204)) {
                await offlineDB.deletePendingChange(change.id);
                successCount++;
                console.log(`Synced: ${change.type} ${change.item.name}`);
            } else {
                await offlineDB.updatePendingChangeStatus(change.id, 'failed');
                failureCount++;
                console.warn(`Failed to sync: ${change.type} ${change.item.name}`);
            }
        } catch (error) {
            console.error(`Error syncing change ${change.id}:`, error);
            await offlineDB.updatePendingChangeStatus(change.id, 'failed');
            failureCount++;
        }
    }

    // Reload items from server
    try {
        const response = await fetch(`${API_URL}/items`);
        if (response.ok) {
            const serverItems = await response.json();
            currentItems = serverItems;
            await offlineDB.saveItems(serverItems);
            renderItems(currentItems);
        }
    } catch (error) {
        console.error('Error reloading items:', error);
    }

    // Reload pending changes
    await loadPendingChanges();
    showSyncButton();

    if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync All Changes';
    }

    alert(`Synced ${successCount} change(s). ${failureCount > 0 ? `${failureCount} failed.` : ''}`);
}