package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func TestGetItems(t *testing.T) {
	// Setup test database connection
	err := godotenv.Load()
	if err != nil {
		t.Fatal("Error loading .env file")
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Clear and add test data
	_, err = db.Exec("DELETE FROM items")
	if err != nil {
		t.Fatal("Failed to clean test data:", err)
	}

	_, err = db.Exec("INSERT INTO items (name, available) VALUES ($1, $2), ($3, $4)", 
		"Milk", true, "Bread", false)
	if err != nil {
		t.Fatal("Failed to insert test data:", err)
	}

	req, _ := http.NewRequest("GET", "/items", nil)
	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/items", getItems).Methods("GET")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var responseItems []Item
	if err := json.NewDecoder(rr.Body).Decode(&responseItems); err != nil {
		t.Fatal("Failed to decode response:", err)
	}

	if len(responseItems) != 2 {
		t.Errorf("Expected 2 items, got %d", len(responseItems))
	}

	// Clean up
	_, err = db.Exec("DELETE FROM items")
	if err != nil {
		t.Fatal("Failed to clean up test data:", err)
	}
}

func TestAddItem(t *testing.T) {
	var jsonStr = []byte(`{"name":"Milk","available":true}`)
	req, _ := http.NewRequest("POST", "/items", bytes.NewBuffer(jsonStr))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/items", addItem).Methods("POST")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var newItem Item
	json.NewDecoder(rr.Body).Decode(&newItem)
	if newItem.Name != "Milk" {
		t.Errorf("handler returned unexpected body: got %v want %v", newItem.Name, "Milk")
	}
}

func TestUpdateItem(t *testing.T) {
	// Setup test database connection
	err := godotenv.Load()
	if err != nil {
		t.Fatal("Error loading .env file")
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Clear test data
	_, err = db.Exec("DELETE FROM items WHERE name = $1", "Bread")
	if err != nil {
		t.Fatal("Failed to clean test data:", err)
	}

	// First, add an item
	item := Item{Name: "Bread", Available: false}
	jsonItem, _ := json.Marshal(item)
	req, _ := http.NewRequest("POST", "/items", bytes.NewBuffer(jsonItem))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/items", addItem).Methods("POST")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("Failed to add item: got status %v", status)
	}

	// Test updating the item
	req, _ = http.NewRequest("PATCH", "/items/Bread", nil)
	rr = httptest.NewRecorder()
	router = mux.NewRouter()
	router.HandleFunc("/items/{name}", updateItem).Methods("PATCH")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Verify the item was updated in the response
	var responseItem Item
	if err := json.NewDecoder(rr.Body).Decode(&responseItem); err != nil {
		t.Fatal("Failed to decode response:", err)
	}

	if !responseItem.Available {
		t.Error("Expected item to be marked as available in response")
	}

	// Verify the item was updated in the database
	var dbItem Item
	err = db.QueryRow("SELECT name, available FROM items WHERE name = $1", "Bread").Scan(&dbItem.Name, &dbItem.Available)
	if err != nil {
		t.Fatal("Failed to query test item:", err)
	}

	if !dbItem.Available {
		t.Error("Expected item to be marked as available in database")
	}
}
