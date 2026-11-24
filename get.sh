#!/bin/bash
# Dartbox one-line installer: downloads the newest release from GitHub and runs install.sh.
#
#   curl -fsSL https://raw.githubusercontent.com/ChrisRich3105/dartbox/main/get.sh | sudo bash
#
# Without sudo rights (Debian with a root password):
#   curl -fsSL https://raw.githubusercontent.com/ChrisRich3105/dartbox/main/get.sh -o get.sh
#   su - -c "bash $PWD/get.sh --user $USER"
#
# Arguments are passed to install.sh (e.g. --user NAME, --no-autodarts, --keep-desktop).
# DARTBOX_TAG=v1.2.0 installs a specific version, DARTBOX_REPO=owner/name a fork.

# Everything is inside main() so that "curl | bash" has read the whole script before it runs.
main() {
    set -euo pipefail
    export PATH="/usr/local/sbin:/usr/sbin:/sbin:$PATH"
    local repo="${DARTBOX_REPO:-ChrisRich3105/dartbox}"
    local tag="${DARTBOX_TAG:-}"
    if [ "$(id -u)" -ne 0 ]; then
        echo "Please run as root (… | sudo bash), see the comments at the top of get.sh" >&2
        exit 1
    fi
    command -v curl >/dev/null || { apt-get update && apt-get install -y curl ca-certificates; }
    command -v python3 >/dev/null || { apt-get update && apt-get install -y python3; }
    if [ -z "$tag" ]; then
        tag=$(curl -fsSL -H "User-Agent: dartbox-installer" "https://api.github.com/repos/$repo/releases/latest" \
              | python3 -c 'import sys, json; print(json.load(sys.stdin)["tag_name"])') \
          || { echo "Could not find a release of $repo on GitHub." >&2; exit 1; }
    fi
    echo "==> Dartbox $tag from github.com/$repo"
    local tmp
    tmp=$(mktemp -d /tmp/dartbox-get.XXXXXX)
    curl -fsSL "https://github.com/$repo/archive/refs/tags/$tag.tar.gz" | tar -xz -C "$tmp"
    local src
    src=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n1)
    # remember the user who called sudo, so Autodarts is installed for them (not for root)
    local args=("$@")
    if [ -n "${SUDO_USER:-}" ] && [[ " $* " != *" --user "* ]]; then args+=(--user "$SUDO_USER"); fi
    bash "$src/install.sh" "${args[@]}" < /dev/null
    rm -rf "$tmp"
}

main "$@"
