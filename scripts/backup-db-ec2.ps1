<#
.SYNOPSIS
  Copia de seguridad de la base de datos PostgreSQL de produccion en EC2.

.DESCRIPTION
  Se conecta por SSH a la instancia EC2, ejecuta pg_dump DENTRO del contenedor
  gather_postgres (misma version que el servidor, sin contrasena por auth local),
  valida el dump con pg_restore --list y lo descarga por scp a backups\db.
  No requiere pg_dump ni Docker en Windows: solo ssh.exe/scp.exe (incluidos en
  Windows 11).

.EXAMPLE
  .\scripts\backup-db-ec2.ps1
  .\scripts\backup-db-ec2.ps1 -Ec2Host 18.221.199.221
  .\scripts\backup-db-ec2.ps1 -OutDir D:\backups\odyssey -Keep 30

.NOTES
  Restaurar un dump sobre la DB de EC2 (destructivo, pisa los datos actuales):
    type backups\db\ARCHIVO.dump | ssh -i od3.pem ec2-user@IP "docker exec -i gather_postgres pg_restore -U postgres -d gather_rpg --clean --if-exists"
#>
[CmdletBinding()]
param(
    [string]$Ec2Host = "3.14.9.51",
    [string]$PemFile = (Join-Path $PSScriptRoot "..\od3.pem"),
    [string]$OutDir  = (Join-Path $PSScriptRoot "..\backups\db"),
    [int]   $Keep    = 14
)

$ErrorActionPreference = "Stop"

$container = "gather_postgres"
$dbName    = "gather_rpg"
$sshUser   = "ec2-user"

if (-not (Test-Path $PemFile)) { throw "No se encontro la clave SSH: $PemFile" }
$PemFile = (Resolve-Path $PemFile).Path
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
$OutDir = (Resolve-Path $OutDir).Path

$stamp      = Get-Date -Format "yyyyMMdd_HHmmss"
$fileName   = "${dbName}_$stamp.dump"
$remoteTmp  = "/tmp/$fileName"              # dentro del contenedor
$remoteHome = "/home/$sshUser/$fileName"    # en la EC2, para el scp
$target     = "$sshUser@$Ec2Host"
$localFile  = Join-Path $OutDir $fileName

$sshOpts = @("-i", $PemFile, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15")

function Invoke-Ssh([string]$RemoteCmd) {
    & ssh @sshOpts $target $RemoteCmd
    if ($LASTEXITCODE -ne 0) { throw "Fallo SSH (codigo $LASTEXITCODE): $RemoteCmd" }
}

Write-Host "Backup de $dbName en $Ec2Host (contenedor $container)"

Write-Host "[1/5] Generando dump remoto (formato custom, comprimido)..."
Invoke-Ssh "docker exec $container pg_dump -U postgres -d $dbName -Fc -Z 6 -f $remoteTmp"

Write-Host "[2/5] Validando integridad del dump..."
Invoke-Ssh "docker exec $container pg_restore --list $remoteTmp > /dev/null"

Write-Host "[3/5] Descargando a $OutDir ..."
Invoke-Ssh "docker cp ${container}:$remoteTmp $remoteHome"
& scp @sshOpts "${target}:$remoteHome" $localFile
if ($LASTEXITCODE -ne 0) { throw "Fallo scp (codigo $LASTEXITCODE)" }

Write-Host "[4/5] Limpiando temporales remotos..."
Invoke-Ssh "docker exec $container rm -f $remoteTmp; rm -f $remoteHome"

$dump = Get-Item $localFile -ErrorAction SilentlyContinue
if (-not $dump -or $dump.Length -eq 0) {
    throw "El backup no se descargo o quedo vacio: $localFile"
}
$sizeMb = [math]::Round($dump.Length / 1MB, 2)
Write-Host "Backup OK: $($dump.FullName) ($sizeMb MB)" -ForegroundColor Green

Write-Host "[5/5] Rotacion local (conservar $Keep copias)..."
$old = Get-ChildItem $OutDir -File -Filter "${dbName}_*.dump" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Keep
if ($old) {
    $old | Remove-Item -Force
    Write-Host "Eliminadas $($old.Count) copias antiguas."
}
