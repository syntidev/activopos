param([string]$msg)
git add .
git commit -m $msg
git push origin main
git log --oneline -3
