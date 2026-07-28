package handlers

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// InfoArtHandler gestiona el arte (PNG/JPG…) de los letreros de información. El arte NO
// vive en el repo (public/), sino en una carpeta de uploads del backend, así solo existe
// el que se sube bajo demanda. Se sirve por la API (/info-art/:file) para que pase por el
// proxy /api y el <img> lo cargue sin auth. El contenido del letrero (markdown) sigue en
// el readText del mueble (map_data), sin cambios de esquema en BD.
// URLPrefix es la ruta pública bajo la que se sirve este arte (p. ej. "/api/info-art").
// Se parametriza para poder montar varias instancias del mismo handler sobre
// carpetas distintas (letreros de info, portadas de mundos y previews de mapas).
type InfoArtHandler struct {
	Dir       string
	URLPrefix string
}

func NewInfoArtHandler() *InfoArtHandler {
	dir := os.Getenv("INFO_ART_DIR")
	if dir == "" {
		dir = filepath.Join("uploads", "info")
	}
	_ = os.MkdirAll(dir, 0755)
	return &InfoArtHandler{Dir: dir, URLPrefix: "/api/info-art"}
}

// NewWorldArtHandler sirve las portadas de mundo y los PNG de preview de cada
// mapa. Misma mecánica que el arte de letreros (sanitizado, tope de 5MB, servido
// sin auth para que el <img> lo cargue), pero en su propia carpeta.
func NewWorldArtHandler() *InfoArtHandler {
	dir := os.Getenv("WORLD_ART_DIR")
	if dir == "" {
		dir = filepath.Join("uploads", "worlds")
	}
	_ = os.MkdirAll(dir, 0755)
	return &InfoArtHandler{Dir: dir, URLPrefix: "/api/world-art"}
}

// urlFor construye la URL pública de un archivo de esta carpeta.
func (h *InfoArtHandler) urlFor(name string) string {
	prefix := h.URLPrefix
	if prefix == "" {
		prefix = "/api/info-art"
	}
	return prefix + "/" + name
}

var (
	allowedArtExt = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true}
	safeNameRe    = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)
)

// sanitizeFilename evita path traversal y caracteres raros, conservando la extensión.
func sanitizeFilename(name string) string {
	name = filepath.Base(name) // descarta cualquier ruta
	ext := strings.ToLower(filepath.Ext(name))
	base := strings.TrimSuffix(name, filepath.Ext(name))
	base = safeNameRe.ReplaceAllString(base, "-")
	base = strings.Trim(base, "-._")
	if base == "" {
		base = "art"
	}
	return base + ext
}

// UploadInfoArt — POST /admin/info-art (multipart "file"). Guarda el PNG/JPG y devuelve su
// nombre y la URL para insertar en el markdown del letrero.
func (h *InfoArtHandler) UploadInfoArt(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No se recibió archivo: " + err.Error()})
	}
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if !allowedArtExt[ext] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Formato no permitido (usa png/jpg/gif/webp)"})
	}
	if fileHeader.Size > 5*1024*1024 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "La imagen supera 5MB"})
	}

	name := sanitizeFilename(fileHeader.Filename)
	if err := os.MkdirAll(h.Dir, 0755); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if err := c.SaveFile(fileHeader, filepath.Join(h.Dir, name)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "No se pudo guardar: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"filename": name,
		"url":      h.urlFor(name), // listo para el markdown del letrero / la portada
	})
}

// ListInfoArt — GET /admin/info-art. Lista el arte disponible (nombre + url).
func (h *InfoArtHandler) ListInfoArt(c *fiber.Ctx) error {
	files, err := os.ReadDir(h.Dir)
	if err != nil {
		// Carpeta aún vacía/inexistente → lista vacía, no error.
		return c.JSON([]any{})
	}
	type art struct {
		Filename string `json:"filename"`
		URL      string `json:"url"`
	}
	out := make([]art, 0, len(files))
	for _, f := range files {
		if f.IsDir() {
			continue
		}
		if allowedArtExt[strings.ToLower(filepath.Ext(f.Name()))] {
			out = append(out, art{Filename: f.Name(), URL: h.urlFor(f.Name())})
		}
	}
	return c.JSON(out)
}

// DeleteInfoArt — DELETE /admin/info-art/:file.
func (h *InfoArtHandler) DeleteInfoArt(c *fiber.Ctx) error {
	name := sanitizeFilename(c.Params("file"))
	if err := os.Remove(filepath.Join(h.Dir, name)); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "No existe: " + name})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ServeInfoArt — GET /info-art/:file (PÚBLICO, sin auth, para que el <img> lo cargue).
// Saneamos el nombre para evitar path traversal.
func (h *InfoArtHandler) ServeInfoArt(c *fiber.Ctx) error {
	name := sanitizeFilename(c.Params("file"))
	path := filepath.Join(h.Dir, name)
	if _, err := os.Stat(path); err != nil {
		return c.Status(fiber.StatusNotFound).SendString("not found")
	}
	return c.SendFile(path, false)
}
