package models

import (
	"time"

	"github.com/google/uuid"
)

// InfoTranslation cachea la traducción del contenido (markdown) de un letrero de info a
// un idioma concreto. Los letreros NO tienen id en BD (su texto vive en readText dentro
// de map_data), así que la clave de cache es el HASH del texto inglés, no un id. Esto
// deduplica letreros idénticos entre mapas y no requiere cambiar el map_data ni el editor.
// El inglés es canónico y nunca se almacena aquí. Uniqueness por (source_hash, lang).
type InfoTranslation struct {
	ID             uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SourceHash     string    `gorm:"type:varchar(64);not null;uniqueIndex:idx_info_hash_lang" json:"source_hash"` // SHA-256 del texto inglés
	Lang           string    `gorm:"type:varchar(10);not null;uniqueIndex:idx_info_hash_lang" json:"lang"`        // ISO-639-1 destino
	SourceText     string    `gorm:"type:text" json:"source_text"`     // el inglés original (referencia/debug)
	TranslatedText string    `gorm:"type:text" json:"translated_text"` // la traducción
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
