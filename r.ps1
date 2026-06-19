# Matar TODO proceso Node.js antes de limpiar
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

# Matar TODO proceso Node.js antes de limpiar
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
