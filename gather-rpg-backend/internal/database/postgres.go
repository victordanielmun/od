package database

import (
	"log"
	"time"

	"gather-rpg-backend/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectPostgres(cfg *config.Config) {
	dsn := cfg.GetDBDSN()
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Connection pool tuning. Matters a lot for a REMOTE DB: keeping idle connections
	// warm avoids paying the TCP+TLS handshake latency on every query, and bounding
	// open connections prevents a request burst from thrashing the remote server.
	if sqlDB, e := DB.DB(); e == nil {
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetConnMaxIdleTime(10 * time.Minute)
		sqlDB.SetConnMaxLifetime(30 * time.Minute)
	}

	log.Println("Connected to PostgreSQL")
}
