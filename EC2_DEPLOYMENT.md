# 🏰 Guía de Despliegue en AWS EC2 (t2.micro / t3.micro) - Odyssey Backend

Esta guía detalla los requisitos, dependencias y pasos necesarios para desplegar y configurar la infraestructura de backend del proyecto **Odyssey** en una instancia **Amazon EC2 micro** con **Amazon Linux 2023** (con **1 GB de RAM** + memoria **Swap**). 

Dado que **no se utiliza Ollama local** (se usa la API de OpenAI), la carga de memoria RAM se reduce drásticamente, lo cual hace totalmente viable correr el Go Backend, el Python Voice Backend y las bases de datos (PostgreSQL y Redis) en una sola instancia micro, siempre y cuando se configure memoria de intercambio (Swap).

---

## ⚡ REGLA DE ORO PARA INSTANCIAS MICRO (1 GB RAM)
> [!IMPORTANT]
> Es **obligatorio** configurar al menos **4 GB de memoria Swap**. 
> Sin esto, el instalador de dependencias de Python (`pip`), el compilador de Go, o el modelo local de Whisper para la transcripción de voz excederán el límite de 1 GB físico y el sistema operativo forzará el cierre de los servicios (OOM Killer).
>
> Como Amazon Linux 2023 utiliza el sistema de archivos **XFS**, el comando estándar `fallocate` para crear el swap fallará o dará problemas. Por ende, **se debe usar `dd`** para reservar el espacio físicamente.
>
> **Nota sobre el espacio en disco:** Si usas un volumen EBS estándar de **8 GB** en AWS (el tamaño por defecto en t2.micro/t3.micro), reservar 4 GB para Swap dejará muy poco espacio para el sistema. Se recomienda **ampliar el volumen de tu EC2 a 15 GB o 20 GB** en la consola de AWS (es totalmente gratis dentro de la capa gratuita de hasta 30 GB). Adicionalmente, la instalación del backend de voz está optimizada para instalar **PyTorch versión CPU-only** y no guardar caché de `pip` en disco, ahorrando más de 2.5 GB.

---

## 🧭 ¿Cómo funcionan los Servicios del Sistema (`systemd`) y las Carpetas?
> [!NOTE]
> Al configurar los servicios mediante `systemd`, **no es necesario que te ubiques en ninguna carpeta en específico para iniciarlos, detenerlos o reiniciarlos**. Los comandos de control (`sudo systemctl restart ...`) se pueden ejecutar desde cualquier lugar de la terminal.
>
> La directiva `WorkingDirectory` dentro de los archivos de configuración `.service` le indica automáticamente al sistema operativo que entre a la carpeta correcta (`/home/ec2-user/od/gather-rpg-backend` o `/home/ec2-user/od/voice/backend`) justo antes de ejecutar la aplicación. De esta forma, el servidor Go y el de Python cargan sus archivos `.env` locales sin ningún problema de rutas.

---

## 🌐 1. Configuración del Grupo de Seguridad (Security Group) en AWS
Asegúrate de configurar las reglas de entrada (Inbound Rules) en el Security Group de tu instancia EC2:

| Tipo | Puerto | Origen | Descripción |
| :--- | :--- | :--- | :--- |
| **SSH** | `22` | Tu IP (o `0.0.0.0/0`) | Acceso seguro a la terminal |
| **HTTP** | `80` | `0.0.0.0/0` | Acceso web estándar (si usas Nginx) |
| **HTTPS** | `443` | `0.0.0.0/0` | Acceso web seguro (si usas Nginx) |
| **Custom TCP** | `3000` | `0.0.0.0/0` (o Nginx) | API de Go Backend |
| **Custom TCP** | `8000` | `0.0.0.0/0` (o Nginx) | API de Voice Backend (Python) |

---

## 🛠️ 2. Preparación del Sistema e Instalación de Dependencias (Amazon Linux 2023)

Conéctate a tu instancia EC2 por SSH (el usuario por defecto en Amazon Linux es `ec2-user`):
```bash
ssh -i "tu-llave.pem" ec2-user@tu-ip-publica-ec2
```

### Paso 2.1: Crear y Habilitar Memoria Swap (4 GB) mediante `dd`
```bash
# Crear un archivo swap vacío de 4GB usando dd (necesario en sistemas XFS de Amazon Linux 2023)
sudo dd if=/dev/zero of=/swapfile bs=1M count=4096

# Asignar permisos correctos de lectura y escritura exclusivos para root
sudo chmod 600 /swapfile

# Configurar el archivo como espacio de intercambio
sudo mkswap /swapfile

# Activar el archivo swap
sudo swapon /swapfile

# Hacer que el cambio sea permanente tras reiniciar la instancia
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

# Verificar que la memoria swap esté activa
free -h
```
Deberías ver `Swap:` con aproximadamente `4.0Gi` disponibles.

### Paso 2.2: Actualizar Paquetes y Herramientas Esenciales (usando `dnf` / `yum`)
```bash
sudo dnf update -y
sudo dnf groupinstall "Development Tools" -y
sudo dnf install -y git wget tar
```

### Paso 2.3: Instalar FFmpeg (Mediante compilación estática)
Dado que Amazon Linux 2023 no incluye `ffmpeg` en sus repositorios por defecto, la forma más rápida y estable de instalarlo en una instancia micro sin consumir CPU compilándolo es descargar un binario estático ya compilado:
```bash
# Descargar binario estático de FFmpeg
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

# Extraer el archivo
tar -xf ffmpeg-release-amd64-static.tar.xz

# Mover los ejecutables a /usr/local/bin
sudo mv ffmpeg-*-static/ffmpeg ffmpeg-*-static/ffprobe /usr/local/bin/

# Limpiar archivos temporales descargados
rm -rf ffmpeg-*-static*

# Verificar instalación
ffmpeg -version
```

### Paso 2.4: Instalar Docker y Docker Compose
Usaremos Docker para levantar PostgreSQL y Redis de manera rápida y ligera.
```bash
# Instalar Docker en Amazon Linux 2023
sudo dnf install -y docker

# Iniciar y habilitar el daemon de Docker
sudo systemctl start docker
sudo systemctl enable docker

# Añadir al usuario ec2-user al grupo docker para evitar usar 'sudo' con docker
sudo usermod -aG docker ec2-user

# Instalar Docker Compose de forma global
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```
*Nota: Cierra la sesión SSH y vuelve a entrar (`exit` y reconectar) para que los permisos de grupo y de comandos tengan efecto sin usar `sudo`.*

### Paso 2.5: Instalar Go 1.24+ (Para el Go Backend)
```bash
# Descargar binario oficial de Go para Linux AMD64
wget https://go.dev/dl/go1.24.0.linux-amd64.tar.gz

# Extraer en /usr/local
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.24.0.linux-amd64.tar.gz

# Configurar variables de entorno de Go en tu perfil (.bashrc)
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc
source ~/.bashrc

# Verificar instalación
go version
```

### Paso 2.6: Instalar Python 3.11+, pip y venv (Para el Voice Backend)
En Amazon Linux 2023, podemos instalar Python 3.11 de la siguiente manera:
```bash
sudo dnf install -y python3.11 python3.11-pip python3.11-devel
```

---

## 🚀 3. Paso a Paso del Despliegue del Proyecto

### Paso 3.1: Descargar el Código en tu Home Directory
El directorio base del proyecto será `/home/ec2-user/od`.
```bash
cd ~
git clone https://github.com/victordanielmun/od.git
cd od
```

### Paso 3.2: Levantar Base de Datos y Cache (PostgreSQL y Redis)
El backend utiliza Docker Compose para configurar PostgreSQL en el puerto `5433` y Redis en el `6379`.

1. Ve a la carpeta del backend de Go:
   ```bash
   cd /home/ec2-user/od/gather-rpg-backend
   ```
2. Crea el archivo de entorno `.env` copiando la plantilla:
   ```bash
   cp .env.example .env
   ```
3. Edita `.env` con tus credenciales (puedes usar `nano .env`):
   ```env
   SERVER_PORT=3000
   ENV=production
   
   # Configuración de base de datos
   DB_HOST=127.0.0.1
   DB_PORT=5433
   DB_USER=postgres
   DB_PASSWORD=una_contrasena_segura_aqui
   DB_NAME=gather_rpg
   
   # Redis
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   REDIS_PASSWORD=otra_contrasena_segura_aqui
   
   # JWT
   JWT_SECRET=escribe_un_secret_muy_largo_y_seguro
   JWT_EXPIRATION=24h
   ```
4. Levanta los contenedores en segundo plano usando Docker Compose:
   ```bash
   docker-compose up -d
   ```
5. Verifica que estén corriendo correctamente:
   ```bash
   docker-compose ps
   ```

---

### Paso 3.3: Configurar y Compilar el Backend de Go
1. Compila el binario de Go para Linux:
   ```bash
   go build -o server cmd/server/main.go
   ```
2. Crea un servicio de `systemd` para que el backend de Go corra en segundo plano y se reinicie automáticamente si falla.
   ```bash
   sudo nano /etc/systemd/system/gather-rpg-backend.service
   ```
   Añade el siguiente contenido (observa que apunta al usuario `ec2-user` y a la carpeta `/home/ec2-user/od/gather-rpg-backend`):
   ```ini
   [Unit]
   Description=Gather RPG Go Backend Service
   After=network.target docker.service

   [Service]
   Type=simple
   User=ec2-user
   WorkingDirectory=/home/ec2-user/od/gather-rpg-backend
   EnvironmentFile=-/home/ec2-user/od/gather-rpg-backend/.env
   ExecStart=/home/ec2-user/od/gather-rpg-backend/server
   Restart=always
   RestartSec=5
   Environment=PATH=/usr/bin:/usr/local/bin:/usr/local/go/bin
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=gather-rpg-backend

   [Install]
   WantedBy=multi-user.target
   ```
3. Habilita e inicia el servicio:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable gather-rpg-backend
   sudo systemctl start gather-rpg-backend
   ```
4. Comprueba que el servicio esté corriendo:
   ```bash
   sudo systemctl status gather-rpg-backend
   ```

---

### Paso 3.4: Configurar y Ejecutar el Backend de Voz (FastAPI)
1. Ve al directorio del backend de voz:
   ```bash
   cd /home/ec2-user/od/voice/backend
   ```
2. Crea el entorno virtual de Python usando Python 3.11 e instala las dependencias (el Swap de 4 GB evitará fallos de memoria durante la instalación de paquetes pesados como numpy):
   ```bash
   python3.11 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   
   # Limpiar caché previo de pip para liberar espacio en disco
   rm -rf ~/.cache/pip
   
   # Instalar PyTorch CPU-only (pesa ~150MB en vez de ~780MB y no instala CUDA/GPU)
   pip install torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu --no-cache-dir
   
   # Instalar setuptools e instalar whisper sin aislamiento de compilación
   pip install "setuptools<70" wheel --no-cache-dir
   pip install openai-whisper==20231117 --no-build-isolation --no-cache-dir
   
   # Instalar el resto de dependencias sin guardar en caché
   pip install -r requirements.txt --no-cache-dir
   ```
3. Crea y configura su respectivo archivo `.env`:
   ```bash
   nano .env
   ```
   Agrega las variables de entorno adecuadas:
   ```env
   # Apuntar a la base de datos de Docker
   DATABASE_URL=postgresql://postgres:una_contrasena_segura_aqui@127.0.0.1:5433/gather_rpg
   DEBUG=False
   
   # Configura las URLs y tokens correspondientes a OpenAI
   OPENAI_API_KEY=tu_openai_api_key_aqui
   
   # Reemplaza por la IP pública de tu EC2 o tu dominio
   CORS_ORIGINS=["http://localhost:5173","http://tu-ip-o-dominio.com"]
   
   UPLOAD_DIR=uploads
   MAX_AUDIO_SIZE_MB=10
   TTS_CACHE_DIR=tts_cache
   ```
4. Sal del entorno virtual:
   ```bash
   deactivate
   ```
5. Crea un servicio de `systemd` para el Voice Backend:
   ```bash
   sudo nano /etc/systemd/system/gather-rpg-voice.service
   ```
   Añade el siguiente contenido:
   ```ini
   [Unit]
   Description=Gather RPG Voice Backend Service (Python FastAPI)
   After=network.target docker.service

   [Service]
   Type=simple
   User=ec2-user
   WorkingDirectory=/home/ec2-user/od/voice/backend
   EnvironmentFile=-/home/ec2-user/od/voice/backend/.env
   ExecStart=/home/ec2-user/od/voice/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
   Restart=always
   RestartSec=5
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=gather-rpg-voice

   [Install]
   WantedBy=multi-user.target
   ```
6. Habilita e inicia el servicio:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable gather-rpg-voice
   sudo systemctl start gather-rpg-voice
   ```
7. Comprueba el estado del servicio:
   ```bash
   sudo systemctl status gather-rpg-voice
   ```

---

## 🛠️ 4. Guía de Control de Servicios: Iniciar, Detener y Reiniciar

Puedes ejecutar estos comandos de control desde **cualquier directorio** de tu servidor, no es necesario situarse dentro de las carpetas de las aplicaciones.

### A. API de Go Backend (`gather-rpg-backend`)
* **Iniciar:**
  ```bash
  sudo systemctl start gather-rpg-backend
  ```
* **Detener:**
  ```bash
  sudo systemctl stop gather-rpg-backend
  ```
* **Reiniciar:**
  ```bash
  sudo systemctl restart gather-rpg-backend
  ```
* **Ver estado actual:**
  ```bash
  sudo systemctl status gather-rpg-backend
  ```
* **Ver Logs en tiempo real:**
  ```bash
  journalctl -u gather-rpg-backend -f -n 100
  ```

---

### B. API de Voice Backend (`gather-rpg-voice`)
* **Iniciar:**
  ```bash
  sudo systemctl start gather-rpg-voice
  ```
* **Detener:**
  ```bash
  sudo systemctl stop gather-rpg-voice
  ```
* **Reiniciar:**
  ```bash
  sudo systemctl restart gather-rpg-voice
  ```
* **Ver estado actual:**
  ```bash
  sudo systemctl status gather-rpg-voice
  ```
* **Ver Logs en tiempo real:**
  ```bash
  journalctl -u gather-rpg-voice -f -n 100
  ```

---

### C. Bases de Datos en Docker (PostgreSQL & Redis)
Los comandos de Docker Compose sí requieren situarse en el directorio del archivo `docker-compose.yml` para cargarlo.
* **Ubicación:** `cd /home/ec2-user/od/gather-rpg-backend`
* **Iniciar bases de datos:**
  ```bash
  docker-compose up -d
  ```
* **Detener bases de datos (conservando persistencia):**
  ```bash
  docker-compose down
  ```
* **Reiniciar bases de datos:**
  ```bash
  docker-compose restart
  ```
* **Ver logs de base de datos en tiempo real:**
  ```bash
  docker-compose logs -f --tail=100
  ```

---

## ⚡ Cheat Sheet: Comandos de Mantenimiento Rápido

### Actualizar y Reiniciar Go Backend:
```bash
cd /home/ec2-user/od
git pull
cd gather-rpg-backend
go build -o server cmd/server/main.go
sudo systemctl restart gather-rpg-backend
```

### Actualizar y Reiniciar Voice Backend:
```bash
cd /home/ec2-user/od
git pull
cd voice/backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart gather-rpg-voice
```
