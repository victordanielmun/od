package config

import (
	"log"
	"os"
	"strconv"
	"strings"

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

	EvolutionAPIURL string
	EvolutionAPIKey string
	PiperExePath    string
	PiperModelsDir  string
	PiperCacheDir   string

	// Wompi billing (membership subscriptions charged via reusable payment sources).
	WompiBaseURL         string // https://production.wompi.co/v1 (or sandbox)
	WompiPublicKey       string // pub_...  (safe to expose to the frontend for card tokenization)
	WompiPrivateKey      string // prv_...  (server-side only)
	WompiEventsSecret    string // used to verify webhook checksums
	WompiIntegritySecret string // used to build the transaction integrity signature
	// Membership pricing/period.
	MembershipAmountCents int64  // e.g. 2000000 = $20.000 COP
	MembershipCurrency    string // "COP"
	MembershipPeriodDays  int    // 30

	// PrecacheLangs are the player languages whose mission/task translations are
	// warmed at startup and on mission edit, so the first dialogue open is fast.
	PrecacheLangs []string

	// AutoMigrate controls whether GORM AutoMigrate runs on startup. Against a remote
	// DB its schema introspection takes minutes, so set AUTO_MIGRATE=false for fast
	// restarts once the schema is stable; set it true after pulling schema changes.
	AutoMigrate bool
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

		EvolutionAPIURL: getEnv("EVOLUTION_API_URL", "http://localhost:8080"),
		EvolutionAPIKey: getEnv("EVOLUTION_API_KEY", "evolution_secret_key"),
		PiperExePath:    getEnv("PIPER_EXE_PATH", "piper"),
		PiperModelsDir:  getEnv("PIPER_MODELS_DIR", "./models"),
		PiperCacheDir:   getEnv("PIPER_CACHE_DIR", "./tts_cache"),

		PrecacheLangs:   parseCSVLangs(getEnv("PRECACHE_LANGS", "es")),
		AutoMigrate:     getEnv("AUTO_MIGRATE", "true") != "false",

		WompiBaseURL:         getEnv("WOMPI_BASE_URL", "https://production.wompi.co/v1"),
		WompiPublicKey:       getEnv("WOMPI_PUBLIC_KEY", ""),
		WompiPrivateKey:      getEnv("WOMPI_PRIVATE_KEY", ""),
		WompiEventsSecret:    getEnv("WOMPI_EVENTS_SECRET", ""),
		WompiIntegritySecret: getEnv("WOMPI_INTEGRITY_SECRET", ""),
		MembershipAmountCents: getEnvInt64("MEMBERSHIP_AMOUNT_CENTS", 2000000),
		MembershipCurrency:    getEnv("MEMBERSHIP_CURRENCY", "COP"),
		MembershipPeriodDays:  int(getEnvInt64("MEMBERSHIP_PERIOD_DAYS", 30)),
	}

	log.Printf("Config Loaded: DB_HOST=%s, DB_PORT=%s, DB_NAME=%s", cfg.DBHost, cfg.DBPort, cfg.DBName)
	return cfg
}

// parseCSVLangs turns "es, pt , fr" into ["es","pt","fr"] (trimmed, lowercased,
// empties dropped). Used for PRECACHE_LANGS.
func parseCSVLangs(csv string) []string {
	parts := strings.Split(csv, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// getEnvInt64 reads an integer env var, falling back to `fallback` when unset or
// unparseable. Used for membership pricing/period knobs.
func getEnvInt64(key string, fallback int64) int64 {
	if value, exists := os.LookupEnv(key); exists {
		if n, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64); err == nil {
			return n
		}
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
