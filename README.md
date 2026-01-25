# Shopping List Application

A simple shopping list application with a Go backend and interactive frontend.

## Features

- Interactive drag-and-drop interface
- Add, update, and delete shopping items
- Filter view for unchecked items
- Persistent storage in PostgreSQL
- Offline support (PWA) with Service Worker

### PWA & Offline Support
The application registers a Service Worker to enable offline functionality. The Service Worker is served from the root path (`/shopping-list/sw.js`) to ensure it can control the entire application scope (`/shopping-list/`). It caches static assets and provides a fallback for API requests when offline.

## API Endpoints

- `GET /api/items` - Get all items
- `POST /api/items` - Add new item
- `PUT /api/items/{name}` - Update item status
- `DELETE /api/items/{name}` - Delete item

## Deployment Guide

### Prerequisites
- Go 1.x installed
- PostgreSQL database
- systemd (for service management)

### Installation Steps

1. Clone the repository:
```bash
git clone <your-repo-url>
cd shopping-list
```

2. Build the application:
```bash
go build -o shopping-list
```

3. Set up the service:
```bash
# Copy the service file to systemd directory
sudo cp shopping-list.service /etc/systemd/system/

# Edit the service file to set your database URL
sudo nano /etc/systemd/system/shopping-list.service

# Reload systemd
sudo systemctl daemon-reload

# Start the service
sudo systemctl start shopping-list

# Enable the service to start on boot
sudo systemctl enable shopping-list
```

4. Check the service status:
```bash
sudo systemctl status shopping-list
```

### Managing the Service

- Start the service:
```bash
sudo systemctl start shopping-list
```

- Stop the service:
```bash
sudo systemctl stop shopping-list
```

- Restart the service:
```bash
sudo systemctl restart shopping-list
```

- View logs:
```bash
sudo journalctl -u shopping-list -f
```

### Updating the Application

1. Pull the latest code:
```bash
git pull origin main
```

2. Rebuild the application:
```bash
go build -o shopping-list
```

3. Restart the service:
```bash
sudo systemctl restart shopping-list
```

Or run the following command to do all steps

```bash
ansible-playbook devops/ansible-playbook.yml --tags "static,build,services" --ask-become-pass
```

### Configuration

The application uses environment variables for configuration:
- `DATABASE_URL`: PostgreSQL connection string
- Default port: 8080

### Troubleshooting

1. If the service fails to start, check the logs:
```bash
sudo journalctl -u shopping-list -n 50
```

2. Verify the database connection:
```bash
sudo systemctl status postgresql
```

3. Check file permissions:
```bash
ls -l shopping-list
sudo chown iamkhush:iamkhush shopping-list
chmod 755 shopping-list
```
- PATCH /items/<name> - Update availability

## Setting up PostgreSQL

Make sure you have PostgreSQL installed and running. Create a database and user for the application:

```sh
psql -U postgres
CREATE DATABASE shopping_list;
CREATE USER username WITH ENCRYPTED PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE shopping_list TO username;
```

Update the connection string in the `.env` file to match your PostgreSQL configuration.

## Setting environment variables

Create a `.env` file in the project root and set the `DATABASE_URL` environment variable to your PostgreSQL connection string. For example:

```dotenv
DATABASE_URL="user=username password=password dbname=shopping_list sslmode=disable"
```

## Running the application

To run the application, make sure you have Go installed. Then, execute the following commands:

```sh
go mod init shopping-list
go get -u github.com/gorilla/mux
go get -u github.com/lib/pq
go get -u github.com/joho/godotenv
go run main.go
```

The server will start on port 8000. You can use the following endpoints:
- `GET /items` - Gets all items
- `POST /items` - Adds new items
- `PATCH /items/{name}` - Update availability

## Sending requests using curl

### Get all items

```sh
curl -X GET http://localhost:8000/items
```

### Add a new item

```sh
curl -X POST http://localhost:8000/items -H "Content-Type: application/json" -d '{"name":"Milk","available":true}'
```

### Update item availability

```sh
curl -X PATCH http://localhost:8000/items/Milk
```
