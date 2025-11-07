package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
)

func TestGetItems(t *testing.T) {
	req, _ := http.NewRequest("GET", "/items", nil)
	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/items", getItems).Methods("GET")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var responseItems []Item
	json.NewDecoder(rr.Body).Decode(&responseItems)
	if len(responseItems) != len(items) {
		t.Errorf("handler returned unexpected body: got %v want %v", len(responseItems), len(items))
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
	items = append(items, Item{Name: "Bread", Available: false})
	req, _ := http.NewRequest("PATCH", "/items/Bread", nil)
	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/items/{name}", updateItem).Methods("PATCH")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var updatedItem Item
	json.NewDecoder(rr.Body).Decode(&updatedItem)
	if !updatedItem.Available {
		t.Errorf("handler returned unexpected body: got %v want %v", updatedItem.Available, true)
	}
}
