// API endpoints
const API_URL = 'https://chaddas.home/shopping-list/api';

// DOM Elements
const shoppingList = document.getElementById('shopping-list');
const newItemInput = document.getElementById('newItem');
const toggleFilterBtn = document.getElementById('toggleFilter');

// State
let showUncheckedOnly = false;
let currentItems = [];

// Load items when page loads
document.addEventListener('DOMContentLoaded', loadItems);

// Enable drag and drop functionality
let draggedItem = null;

// Load all items from the API
async function loadItems() {
    try {
        const response = await fetch(`${API_URL}/items`);
        const items = await response.json();
        currentItems = items;
        renderItems(items);
    } catch (error) {
        console.error('Error loading items:', error);
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
    checkbox.addEventListener('change', () => toggleItemStatus(item.name, checkbox.checked));

    const span = document.createElement('span');
    span.textContent = item.name;
    span.title = 'Double-click to edit'; // Add a tooltip
    span.addEventListener('dblclick', () => editItemName(item, span));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete item';
    deleteBtn.addEventListener('click', () => deleteItem(item.name));

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
                const response = await fetch(`${API_URL}/items/${encodeURIComponent(oldName)}`, {
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
                } else {
                    const error = await response.text();
                    alert(`Error updating item: ${error}`);
                    input.replaceWith(span);
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

// Add a new item
async function addNewItem() {
    const name = newItemInput.value.trim();
    if (!name) return;

    try {
        const response = await fetch(`${API_URL}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                available: false
            })
        });

        if (response.ok) {
            newItemInput.value = '';
            loadItems();
        } else {
            const error = await response.text();
            alert(error);
        }
    } catch (error) {
        console.error('Error adding item:', error);
    }
}

// Toggle item status (available/unavailable)
async function toggleItemStatus(name, available) {
    try {
        const response = await fetch(`${API_URL}/items/${encodeURIComponent(name)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                available: available
            })
        });

        if (response.ok) {
            // Update the item in our current items array
            const itemIndex = currentItems.findIndex(item => item.name === name);
            if (itemIndex !== -1) {
                currentItems[itemIndex].available = available;
                // Re-render the list to apply the filter if active
                renderItems(currentItems);
            }
        }
    } catch (error) {
        console.error('Error updating item:', error);
    }
}

// Delete an item
async function deleteItem(name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/items/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Remove the item from our current items array
            currentItems = currentItems.filter(item => item.name !== name);
            // Re-render the list
            renderItems(currentItems);
        } else {
            const error = await response.text();
            alert(error);
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
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