package utils

import "strings"

// languageNames maps ISO-639-1 codes to their English name, used to build LLM prompts
// ("provide a translation in Portuguese"). Extend freely; unknown codes fall back to
// the code itself so the LLM still gets a usable hint.
var languageNames = map[string]string{
	"en": "English",
	"es": "Spanish",
	"pt": "Portuguese",
	"fr": "French",
	"de": "German",
	"it": "Italian",
	"ru": "Russian",
	"ja": "Japanese",
	"ko": "Korean",
	"zh": "Chinese",
	"ar": "Arabic",
	"hi": "Hindi",
	"tr": "Turkish",
	"pl": "Polish",
	"nl": "Dutch",
	"id": "Indonesian",
	"vi": "Vietnamese",
	"th": "Thai",
	"uk": "Ukrainian",
	"ro": "Romanian",
	"sv": "Swedish",
	"fil": "Filipino",
}

// NormalizeLang lowercases and trims a language code, defaulting to "en" when empty.
func NormalizeLang(code string) string {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return "en"
	}
	return code
}

// LanguageName returns the English display name for an ISO-639-1 code (e.g. "es" -> "Spanish").
// Falls back to the normalized code itself for unknown languages.
func LanguageName(code string) string {
	code = NormalizeLang(code)
	if name, ok := languageNames[code]; ok {
		return name
	}
	return code
}

// IsEnglish reports whether the code refers to English (the language being learned),
// in which case no native-language helper translation is needed.
func IsEnglish(code string) bool {
	return NormalizeLang(code) == "en"
}
