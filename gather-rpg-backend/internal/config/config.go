package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort string
	Env        string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	RedisHost     string
	RedisPort     string
	RedisPassword string

	JWTSecret     string
	JWTExpiration string

	DeepSeekAPIKey string
	DeepSeekModel  string

	AIProvider     string
	OpenAIAPIKey   string
	OpenAIModel    string
	MistralAPIKey  string
	MistralModel   string
}

func LoadConfig() *Config {
	// Load .env file if it exists
	if err := godotenv.Load(".env"); err != nil {
		log.Printf("Warning: Error loading .env file: %v. Working directory might be: %s", err, getWorkingDir())
	}

	cfg := &Config{
		ServerPort: getEnv("SERVER_PORT", "3000"),
		Env:        getEnv("ENV", "development"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgres"),
		DBName:     getEnv("DB_NAME", "gather_rpg"),

		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),

		JWTSecret:     getEnv("JWT_SECRET", "secret"),
		JWTExpiration: getEnv("JWT_EXPIRATION", "24h"),

		DeepSeekAPIKey: getEnv("DEEPSEEK_API_KEY", ""),
		DeepSeekModel:  getEnv("DEEPSEEK_MODEL", "deepseek-chat"),

		AIProvider:     getEnv("AI_PROVIDER", "deepseek"),
		OpenAIAPIKey:   getEnv("OPENAI_API_KEY", ""),
		OpenAIModel:    getEnv("OPENAI_MODEL", "gpt-4o"),
		MistralAPIKey:  getEnv("MISTRAL_API_KEY", ""),
		MistralModel:   getEnv("MISTRAL_MODEL", "mistral-large-latest"),
	}

	log.Printf("Config Loaded: DB_HOST=%s, DB_PORT=%s, DB_NAME=%s", cfg.DBHost, cfg.DBPort, cfg.DBName)
	return cfg
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func (c *Config) GetDBDSN() string {
	return "host=" + c.DBHost + " user=" + c.DBUser + " password=" + c.DBPassword + " dbname=" + c.DBName + " port=" + c.DBPort + " sslmode=disable TimeZone=UTC"
}

func getWorkingDir() string {
	dir, err := os.Getwd()
	if err != nil {
		return "unknown"
	}
	return dir
}
