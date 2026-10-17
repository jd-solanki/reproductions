#!/usr/bin/env bash
# Relocks this workspace the way Renovate does after bumping one dependency: cold store and cache,
# inside a Linux container whose memory is capped at $CAP. Exit code 137 means the kernel
# OOM-killed it.
set -u
PNPM_VERSION=${PNPM_VERSION:-12.14.0}
CAP=${CAP:-2250m}

script=$(cat <<'EOF'
npm install --global --silent "pnpm@$PNPM_VERSION" > /dev/null
cp -r /src/. /work && rm -rf /work/.git && cd /work
# The specifier bump Renovate's vue-router branch makes.
sed -i -E 's/^(  vue-router: ).*/\1^5.4.0/' pnpm-workspace.yaml
echo 0 > /tmp/peak
(while sleep 0.2; do
  rss=$(ps -eo rss= | awk '{ s += $1 } END { print s }')
  [ "$rss" -gt "$(cat /tmp/peak)" ] && echo "$rss" > /tmp/peak
done) &
CI=true pnpm install --lockfile-only --recursive --ignore-scripts --ignore-pnpmfile --no-frozen-lockfile
status=$?
echo "pnpm $PNPM_VERSION${MALLOC_ARENA_MAX:+ with MALLOC_ARENA_MAX=$MALLOC_ARENA_MAX}: exit $status, peak RSS $(awk '{ printf "%.2f GB", $1 / 1e6 }' /tmp/peak) (cap $CAP)"
exit $status
EOF
)

docker run --rm --memory="$CAP" --memory-swap="$CAP" \
  -e PNPM_VERSION="$PNPM_VERSION" -e CAP="$CAP" -e MALLOC_ARENA_MAX \
  -v "$PWD":/src:ro node:24 bash -c "$script"
status=$?
# The OOM killer sometimes takes the whole container, summary line included.
[ "$status" -eq 137 ] && echo "repro.sh: container exited 137, OOM-killed under the $CAP cap"
exit "$status"
