package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/mux"
)

func TestMain(m *testing.M) {
	os.Setenv("ENV", "test")
	initDB()
	code := m.Run()
	os.Exit(code)
}

func TestAddItemSQL(t *testing.T) {
	rows := sqlmock.NewRows([]string{"id"}).AddRow(1)
	mock.ExpectQuery("INSERT INTO items").WithArgs("Milk", true).WillReturnRows(rows)

	var jsonStr = []byte(`{"name":"Milk","available":true}`)
	req, _ := http.NewRequest("POST", "/shopping-list/api/items", bytes.NewBuffer(jsonStr))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/shopping-list/api/items", addItem).Methods("POST")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var newItem Item
	json.NewDecoder(rr.Body).Decode(&newItem)
	if newItem.Name != "Milk" {
		t.Errorf("handler returned unexpected body: got %v want %v", newItem.Name, "Milk")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("there were unfulfilled expectations: %s", err)
	}
}

func TestGetItemsSQL(t *testing.T) {
	rows := sqlmock.NewRows([]string{"id", "name", "available"}).
		AddRow(1, "Milk", true).
		AddRow(2, "Bread", false)
	mock.ExpectQuery("SELECT id, name, available FROM items").WillReturnRows(rows)

	req, _ := http.NewRequest("GET", "/shopping-list/api/items", nil)
	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/shopping-list/api/items", getItems).Methods("GET")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var items []Item
	json.NewDecoder(rr.Body).Decode(&items)
	if len(items) != 2 {
		t.Errorf("handler returned unexpected number of items: got %v want %v", len(items), 2)
	}
}

func TestUpdateItemSQL(t *testing.T) {
	mock.ExpectExec("UPDATE items").WithArgs("Milk", true, "1").WillReturnResult(sqlmock.NewResult(1, 1))

	var jsonStr = []byte(`{"name":"Milk","available":true}`)
	req, _ := http.NewRequest("PUT", "/shopping-list/api/items/1", bytes.NewBuffer(jsonStr))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/shopping-list/api/items/{id}", updateItem).Methods("PUT")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}
}

func TestDeleteItemSQL(t *testing.T) {
	mock.ExpectExec("DELETE FROM items").WithArgs("1").WillReturnResult(sqlmock.NewResult(1, 1))

	req, _ := http.NewRequest("DELETE", "/shopping-list/api/items/1", nil)
	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/shopping-list/api/items/{id}", deleteItem).Methods("DELETE")
	router.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusNoContent {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusNoContent)
	}
}
