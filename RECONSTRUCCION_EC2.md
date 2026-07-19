# Reconstrucción del backend en EC2 (BD desde cero)

Runbook para cuando se pierde la instancia/BD. La instalación base (swap, Go,
Docker, Piper, systemd, Nginx) está en [EC2_DEPLOYMENT.md](EC2_DEPLOYMENT.md);
esto cubre solo **.env + esquema + datos iniciales**.

## 0. Archivos .env ya reconstruidos en este repo

| Archivo local | Destino en EC2 |
| --- | --- |
| `gather-rpg-backend/.env.ec2` | `/home/ec2-user/od/gather-rpg-backend/.env` |
| `voice/backend/.env.ec2` | `/home/ec2-user/od/voice/backend/.env` |

Antes de subirlos, llenar los `<PENDIENTE>`: `OPENAI_API_KEY` y las 4 llaves de
Wompi (panel comercios.wompi.co → Desarrolladores). Los passwords de
Postgres/Redis y el `JWT_SECRET` ya vienen generados (nuevos). Subirlos:

```bash
scp -i "od2.pem" gather-rpg-backend/.env.ec2 ec2-user@<IP>:/home/ec2-user/od/gather-rpg-backend/.env
scp -i "od2.pem" voice/backend/.env.ec2     ec2-user@<IP>:/home/ec2-user/od/voice/backend/.env
```

## 1. Levantar Postgres + Redis

```bash
cd /home/ec2-user/od/gather-rpg-backend
docker-compose up -d        # lee DB_PASSWORD/REDIS_PASSWORD del .env
docker-compose ps
```

> Si el volumen `postgres_data` ya existía con otro password, el password del
> .env NO se aplica solo: `docker-compose down -v` para empezar limpio.

## 2. Esquema completo (enums + todas las tablas)

El `.env.ec2` trae `AUTO_MIGRATE=true`. El **primer arranque** del server crea
todo el esquema (incluye `user_blocks`, `subscriptions`, etc. — el dump viejo
`gather_rpg.sql` del 3-jun está desactualizado, no usarlo):

```bash
go build -o server cmd/server/main.go
sudo systemctl restart gather-rpg-backend
journalctl -u gather-rpg-backend -f    # esperar "Config Loaded" + migración sin errores
```

Cuando termine, poner `AUTO_MIGRATE=false` en el .env y reiniciar el servicio
(arranque rápido).

## 3. Seeds estáticos (idempotentes)

```bash
cd /home/ec2-user/od/gather-rpg-backend
go run ./cmd/seed
```

Crea: **usuario admin `admin@odyssey.dev` / `Admin123!`** (¡cambiar el password
en producción!), 6 retos base, catálogo de motivaciones WhatsApp, skills
(Fire Rain/Wave/Nova) + scrolls + pociones + daga, frases del guía y retos de
phrasal verbs.

## 4. Retos de nivel básico (SQL masivo)

```bash
docker exec -i gather_postgres psql -U postgres -d gather_rpg < /home/ec2-user/od/basic_challenges.sql
```

## 5. Contenido vía panel admin (login con el admin del paso 3)

- **Retos adicionales**: importar `learning_challenges.csv` (import CSV del
  admin de retos).
- **Mapas**: importar `map_export.json` (admin de mapas).
- **Misiones y NPCs**: no tienen seed en código; recrearlas en el panel admin.
  `seed_data.sql` solo tiene una misión de ejemplo; el formato de inserción
  manual está en `Insertar mision con task.md`.

## 6. Verificación

```bash
curl http://127.0.0.1:3000/          # Go backend arriba
curl http://127.0.0.1:8000/docs      # voice backend arriba
```

Y desde el navegador: login con el admin, abrir el lobby, hablar con un NPC
(prueba LLM + TTS Piper).

## Nota si la instancia vieja aún existe

Si solo se perdió la llave SSH (no la instancia), los datos siguen en el
volumen Docker `postgres_data`. Antes de recrear nada: recuperar acceso con
**EC2 Instance Connect** o reinyectando la llave vía *user data* / detach del
volumen EBS, y hacer `pg_dump`. Reconstruir desde cero pierde usuarios,
progreso y suscripciones reales.
