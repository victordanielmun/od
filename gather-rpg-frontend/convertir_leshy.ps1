$charsDir = Join-Path (Split-Path -Parent $PSCommandPath) 'public\characters'
Set-Location $charsDir
$files = Get-ChildItem -Filter '*.txt' | Where-Object { $_.Name -match '^\d+[abcd]\.txt$' } | Sort-Object Name
Write-Host 'Archivos encontrados:' $files.Count
$ok = 0; $err = 0
foreach ($f in $files) {
    $base = $f.BaseName
    $id = $base.Substring(0, $base.Length - 1)
    $type = $base.Substring($base.Length - 1)
    Write-Host ('--- ' + $f.Name + ' ---')
    node leshy_to_json.cjs $id $type
    if ($LASTEXITCODE -eq 0) { $ok++ } else { $err++ }
}
Write-Host ('Resultado: ' + $ok + ' OK, ' + $err + ' errores')
if ($ok -gt 0) { node map_character_frames.cjs }
Set-Location (Split-Path -Parent $PSCommandPath)