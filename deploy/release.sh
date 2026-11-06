#!/bin/sh
set -eu

app=/srv/caderno-enem
repo=https://github.com/felipesdotdev/enem.git
ref=${1:-origin/main}

umask 022
exec 9>"$app/release.lock"
flock -x 9

candidate=$(mktemp -d "$app/releases/release.XXXXXXXX")
chmod 755 "$candidate"
git clone --quiet --no-checkout "$repo" "$candidate"
revision=$(git -C "$candidate" rev-parse --verify --end-of-options "$ref^{commit}")
git -C "$candidate" checkout --quiet --detach "$revision"

(
    cd "$candidate"
    npm ci --include=dev
    npm run build
    npm prune --omit=dev
)

previous=$(readlink "$app/current" || true)
switch="$app/current.next"
rm -f -- "$switch"
ln -s "$candidate" "$switch"
mv -Tf "$switch" "$app/current"

check_health() {
    attempt=0
    until curl -fsS --max-time 3 -o /dev/null http://127.0.0.1:3764/api/health; do
        attempt=$((attempt + 1))
        [ "$attempt" -lt 15 ] || return 1
        sleep 1
    done
}

if sudo systemctl restart caderno-enem.service && check_health; then
    printf 'Versão ativa: %s\n' "$revision"
    exit 0
fi

if [ -n "$previous" ]; then
    ln -s "$previous" "$switch"
    mv -Tf "$switch" "$app/current"
    sudo systemctl restart caderno-enem.service
    check_health
else
    sudo systemctl stop caderno-enem.service
    rm -- "$app/current"
fi

printf 'Falha ao ativar %s. Consulte journalctl -u caderno-enem.service.\n' "$revision" >&2
exit 1
