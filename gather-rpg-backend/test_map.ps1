$ErrorActionPreference = "Stop"

$LoginBody = @{
    email = "admin@odyssey.dev"
    password = "Admin123!" 
} | ConvertTo-Json

$LoginResponse = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -Body $LoginBody -ContentType "application/json"
$Token = $LoginResponse.token
if (-not $Token) {
    Write-Output "Failed to get token"
    exit
}

Write-Output "Successfully obtained token: ${Token}"
$Headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}
# The Map ID provided by the user
$MapId = "51561b23-7815-4b0d-b275-2ec8bf259135"

$MapBody = @"
{
    "scene_key": "tienda",
    "walls_json": "{\n  \"width\": 400,\n  \"height\": 400,\n  \"walls\": [],\n  \"floors\": [\n    {\n      \"x\": 350,\n      \"y\": 250,\n      \"frame\": \"sprite1\"\n    }\n  ],\n  \"forest\": [],\n  \"builds\": [\n    {\n      \"x\": 50,\n      \"y\": 250,\n      \"frame\": \"sprite35\",\n      \"scale\": 2,\n      \"targetMap\": \"lobby\",\n      \"targetX\": \"100\",\n      \"targetY\": \"100\",\n      \"portalType\": \"map\"\n    }\n  ],\n  \"spawns\": [],\n  \"npcZones\": [],\n  \"voids\": []\n}",
    "map_data": "{\"width\":400,\"height\":400,\"defaultSpawnX\":200,\"defaultSpawnY\":100,\"bgmTrack\":\"none\"}",
    "is_public": true,
    "max_users": 50
}
"@

Write-Output "Sending PUT request to update map..."
$PutResponse = Invoke-RestMethod -Uri "http://localhost:3000/admin/maps/$MapId" -Method Put -Body $MapBody -Headers $Headers
Write-Output "PUT Response:"
$PutResponse | ConvertTo-Json -Depth 5

Write-Output "`nSending GET request to verify..."
$GetResponse = Invoke-RestMethod -Uri "http://localhost:3000/maps/config?scene_key=tienda" -Method Get -Headers $Headers
Write-Output "GET Response:"
$GetResponse | ConvertTo-Json -Depth 5

Write-Output "`nSending GET ALL request (should be empty walls)..."
$GetAllResponse = Invoke-RestMethod -Uri "http://localhost:3000/admin/maps" -Method Get -Headers $Headers
Write-Output "GET ALL Response:"
$GetAllResponse | ConvertTo-Json -Depth 5
