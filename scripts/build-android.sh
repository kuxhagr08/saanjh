#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------------
# APNA Android Automated Build Script
# Builds Web Assets, Syncs Capacitor, and Produces Debug & Release Binaries
# -------------------------------------------------------------

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/Cellar/openjdk@21/21.0.13.0.3/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$WORKSPACE_ROOT/frontend"
ANDROID_DIR="$FRONTEND_DIR/android"

KEYSTORE_DIR="$HOME/.apna-keystore"
KEYSTORE_PATH="$KEYSTORE_DIR/apna-release-key.jks"
export APNA_KEYSTORE_PATH="$KEYSTORE_PATH"
export APNA_KEY_ALIAS="apna-upload-key"
export APNA_KEYSTORE_PASSWORD="${APNA_KEYSTORE_PASSWORD:-ApnaSecurity2026!}"
export APNA_KEY_PASSWORD="${APNA_KEY_PASSWORD:-ApnaSecurity2026!}"

echo "=== APNA Android Build Pipeline ==="
echo "Workspace:   $WORKSPACE_ROOT"
echo "Java Home:   $JAVA_HOME"
echo "Android SDK: $ANDROID_HOME"
echo ""

# 1. Generate Keystore outside repository if missing
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo "[1/4] Generating upload keystore outside repository at: $KEYSTORE_PATH"
    mkdir -p "$KEYSTORE_DIR"
    "$JAVA_HOME/bin/keytool" -genkeypair -v \
        -keystore "$KEYSTORE_PATH" \
        -alias "$APNA_KEY_ALIAS" \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass "$APNA_KEYSTORE_PASSWORD" \
        -keypass "$APNA_KEY_PASSWORD" \
        -dname "CN=APNA, OU=Engineering, O=APNA India, L=Bengaluru, ST=Karnataka, C=IN"
else
    echo "[1/4] Keystore found at $KEYSTORE_PATH"
fi

# 2. Build Frontend
echo "[2/4] Building web application bundle..."
cd "$FRONTEND_DIR"
npm run build

# 3. Capacitor Sync
echo "[3/4] Syncing assets to native Android project..."
npx cap sync android

# 4. Gradle Compilation
echo "[4/4] Compiling Debug APK, Release APK and Release AAB..."
cd "$ANDROID_DIR"
./gradlew assembleDebug assembleRelease bundleRelease --no-daemon

echo ""
echo "=== Build Artifacts Generated Successfully ==="
DEBUG_APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
RELEASE_APK="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
RELEASE_AAB="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

ls -lh "$DEBUG_APK" "$RELEASE_APK" "$RELEASE_AAB"

echo ""
echo "Debug APK:   $DEBUG_APK ($(ls -lh "$DEBUG_APK" | awk '{print $5}'))"
echo "Release APK: $RELEASE_APK ($(ls -lh "$RELEASE_APK" | awk '{print $5}'))"
echo "Release AAB: $RELEASE_AAB ($(ls -lh "$RELEASE_AAB" | awk '{print $5}'))"
