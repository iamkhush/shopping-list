package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type Item struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Available bool   `json:"available"`
}

var db *sql.DB
var mock sqlmock.Sqlmock

func initDB() {
	var err error
	if os.Getenv("ENV") == "test" {
		db, mock, err = sqlmock.New()
		if err != nil {
			log.Fatalf("an error '%s' was not expected when opening a stub database connection", err)
		}
	} else {
		err = godotenv.Load()
		if err != nil {
			log.Fatal("Error loading .env file")
		}

		connStr := os.Getenv("DATABASE_URL")
		if connStr == "" {
			log.Fatal("DATABASE_URL environment variable is not set")
		}
		db, err = sql.Open("postgres", connStr)
		if err != nil {
			log.Fatal(err)
		}

		_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS items (
		id BIGSERIAL PRIMARY KEY,
		name TEXT,
		available BOOLEAN
	)`)
		if err != nil {
			log.Fatal(err)
		}
	}
}

func getItems(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, name, available FROM items")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var item Item
		if err := rows.Scan(&item.ID, &item.Name, &item.Available); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func addItem(w http.ResponseWriter, r *http.Request) {
	var item Item
	_ = json.NewDecoder(r.Body).Decode(&item)

	err := db.QueryRow("INSERT INTO items (name, available) VALUES ($1, $2) RETURNING id", item.Name, item.Available).Scan(&item.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

func updateItem(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	var item Item
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err := db.Exec("UPDATE items SET name = $1, available = $2 WHERE id = $3", item.Name, item.Available, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

func deleteItem(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	result, err := db.Exec("DELETE FROM items WHERE id = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if rowsAffected == 0 {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func main() {
	initDB()
	defer db.Close()
	// By enabling StrictSlash, the router will automatically redirect
	// paths with/without a trailing slash. e.g. /shopping-list to /shopping-list/
	router := mux.NewRouter().StrictSlash(true)
	subrouter := router.PathPrefix("/shopping-list").Subrouter()

	// API routes
	subrouter.HandleFunc("/api/items", getItems).Methods("GET")
	subrouter.HandleFunc("/api/items", addItem).Methods("POST")
	subrouter.HandleFunc("/api/items/{id}", updateItem).Methods("PUT")
	subrouter.HandleFunc("/api/items/{id}", deleteItem).Methods("DELETE")

	// Serve static files
	subrouter.PathPrefix("/static/").Handler(http.StripPrefix("/shopping-list/static/", http.FileServer(http.Dir("./static/"))))

	// Serve index.html at root
	subrouter.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Println("Serving index.html")
		http.ServeFile(w, r, "index.html")
	}).Methods("GET")

	// Add CORS middleware
	corsMiddleware := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	// Get port from environment variable or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "9876" // Default port
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("This is a test message to check if the changes are being applied correctly.")
	log.Fatal(http.ListenAndServe(":"+port, corsMiddleware(router)))
}
