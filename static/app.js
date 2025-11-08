// API endpoints
const API_URL = '/shopping-list/api';
const OFFLINE_ITEMS_KEY = 'shopping-list-offline-items';

// DOM Elements
const shoppingList = document.getElementById('shopping-list');
const newItemInput = document.getElementById('newItem');
const toggleFilterBtn = document.getElementById('toggleFilter');

// State
let showUncheckedOnly = false;
let currentItems = [];
let isOnline = navigator.onLine;

// Load items when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadItems();
    // Set initial online status
    updateOnlineStatus();
});

// Online/Offline status
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
    isOnline = navigator.onLine;
    document.body.classList.toggle('offline', !isOnline);
    if (isOnline) {
        syncPendingActions().then(() => loadItems());
    }
}

// Load all items from the API or cache
async function loadItems() {
    try {
        if (isOnline) {
            const response = await fetch(`${API_URL}/items`);
            const items = await response.json();
            currentItems = items;
            localStorage.setItem(OFFLINE_ITEMS_KEY, JSON.stringify(items));
        } else {
            const savedItems = localStorage.getItem(OFFLINE_ITEMS_KEY);
            currentItems = savedItems ? JSON.parse(savedItems) : [];
        }
        renderItems(currentItems);
    } catch (error) {
        console.error('Error loading items:', error);
        const savedItems = localStorage.getItem(OFFLINE_ITEMS_KEY);
        currentItems = savedItems ? JSON.parse(savedItems) : [];
        renderItems(currentItems);
    }
}

// Toggle filter for unchecked items
function toggleUncheckedFilter() {
    showUncheckedOnly = !showUncheckedOnly;
    toggleFilterBtn.classList.toggle('active', showUncheckedOnly);
    toggleFilterBtn.textContent = showUncheckedOnly ? 'Show All Items' : 'Show Unchecked Only';
    renderItems(currentItems);
}

// Render items in the list
function renderItems(items) {
    shoppingList.innerHTML = '';
    const filteredItems = showUncheckedOnly ? items.filter(item => !item.available) : items;
    filteredItems.forEach(item => {
        shoppingList.appendChild(createItemElement(item));
    });
}

// Create a new list item element
function createItemElement(item) {
    const li = document.createElement('li');
    li.className = 'shopping-item' + (item.available ? ' completed' : '');
    li.draggable = true;
    li.dataset.name = item.name;

    // Add drag and drop attributes
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', handleDrop);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.available;
    checkbox.addEventListener('change', () => toggleItemStatus(item.name, checkbox.checked));

    const span = document.createElement('span');
    span.textContent = item.name;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete item';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(item.name);
    });

    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(deleteBtn);

    return li;
}

// Add a new item
async function addNewItem() {
    const name = newItemInput.value.trim();
    if (!name) return;

    const newItem = { name, available: false };

    if (isOnline) {
        try {
            const response = await fetch(`${API_URL}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });
            const addedItem = await response.json();
            currentItems.push(addedItem);
        } catch (error) {
            console.error('Failed to add item online, saving for later:', error);
            saveItemForLater('add', newItem);
            currentItems.push(newItem);
        }
    } else {
        saveItemForLater('add', newItem);
        currentItems.push(newItem);
    }

    renderItems(currentItems);
    newItemInput.value = '';
    saveItemsToLocal();
}

// Toggle item status
async function toggleItemStatus(name, available) {
    const item = currentItems.find(item => item.name === name);
    if (!item) return;

    item.available = available;
    renderItems(currentItems);
    saveItemsToLocal();

    if (isOnline) {
        try {
            await fetch(`${API_URL}/items/${encodeURIComponent(name)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ available })
            });
        } catch (error) {
            console.error('Failed to update item status:', error);
            saveItemForLater('update', { name, available });
        }
    } else {
        saveItemForLater('update', { name, available });
    }
}

// Delete an item
async function deleteItem(name) {
    currentItems = currentItems.filter(item => item.name !== name);
    renderItems(currentItems);
    saveItemsToLocal();

    if (isOnline) {
        try {
            await fetch(`${API_URL}/items/${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Failed to delete item:', error);
            saveItemForLater('delete', { name });
        }
    } else {
        saveItemForLater('delete', { name });
    }
}

// Save items to local storage
function saveItemsToLocal() {
    localStorage.setItem(OFFLINE_ITEMS_KEY, JSON.stringify(currentItems));
}

// Save action for later sync
function saveItemForLater(action, item) {
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    pendingActions.push({ action, item, timestamp: Date.now() });
    localStorage.setItem('pendingActions', JSON.stringify(pendingActions));
    saveItemsToLocal();
}

// Sync pending actions when back online
async function syncPendingActions() {
    const pendingActions = JSON.parse(localStorage.getItem('pendingActions') || '[]');
    if (pendingActions.length === 0) return;

    for (const action of [...pendingActions]) {
        try {
            if (action.action === 'add') {
                await fetch(`${API_URL}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(action.item)
                });
            } else if (action.action === 'update') {
                await fetch(`${API_URL}/items/${encodeURIComponent(action.item.name)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ available: action.item.available })
                });
            } else if (action.action === 'delete') {
                await fetch(`${API_URL}/items/${encodeURIComponent(action.item.name)}`, {
                    method: 'DELETE'
                });
            }

            // Remove the action if successful
            const index = pendingActions.findIndex(a => a.timestamp === action.timestamp);
            if (index > -1) {
                pendingActions.splice(index, 1);
                localStorage.setItem('pendingActions', JSON.stringify(pendingActions));
            }
        } catch (error) {
            console.error('Failed to sync action:', action, error);
            return;
        }
    }
}

// Drag and Drop Handlers
function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd() {
    this.classList.remove('dragging');
    draggedItem = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    if (draggedItem !== this) {
        // Get the items
        const items = Array.from(shoppingList.children);
        const fromIndex = items.indexOf(draggedItem);
        const toIndex = items.indexOf(this);
        
        // Reorder items
        if (fromIndex < toIndex) {
            this.after(draggedItem);
        } else {
            this.before(draggedItem);
        }
        
        // Update the currentItems array
        const [movedItem] = currentItems.splice(fromIndex, 1);
        currentItems.splice(toIndex, 0, movedItem);
        
        // Save the new order
        saveItemsToLocal();
    }
}

// Initialize
if (isOnline) {
    syncPendingActions();
}