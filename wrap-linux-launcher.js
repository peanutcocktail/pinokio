const fs = require('fs')
const path = require('path')
module.exports = async (context) => {
  const { appOutDir, electronPlatformName, packager } = context

  if (electronPlatformName !== 'linux') {
    return
  }

  const exeName = packager.executableName || packager.appInfo.productFilename
  const exePath = path.join(appOutDir, exeName)
  const wrappedExePath = path.join(appOutDir, `${exeName}-bin`)

  if (!fs.existsSync(exePath)) {
    console.warn(`[wrap-linux-launcher] Executable not found at ${exePath}, skipping wrapper`)
    return
  }

  const originalStat = fs.statSync(exePath)

  fs.renameSync(exePath, wrappedExePath)

  const wrapperScript = `#!/usr/bin/env sh
SCRIPT_PATH="$0"
RESOLVED_PATH=""

if command -v readlink >/dev/null 2>&1; then
  RESOLVED_PATH="$(readlink -f "$SCRIPT_PATH" 2>/dev/null || true)"
fi

if [ -z "$RESOLVED_PATH" ] && command -v realpath >/dev/null 2>&1; then
  RESOLVED_PATH="$(realpath "$SCRIPT_PATH" 2>/dev/null || true)"
fi

if [ -n "$RESOLVED_PATH" ]; then
  SCRIPT_DIR="$(dirname "$RESOLVED_PATH")"
else
  SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
fi

OPT_BIN="/opt/Pinokio/${exeName}-bin"
LOCAL_BIN="$SCRIPT_DIR/${exeName}-bin"

if [ -x "$OPT_BIN" ]; then
  TARGET_BIN="$OPT_BIN"
else
  TARGET_BIN="$LOCAL_BIN"
fi

# GPU acceleration flags safe for modern Linux GPUs (NVIDIA CUDA, AMD ROCm, Intel Arc)
GPU_FLAGS="--enable-gpu-rasterization --ignore-gpu-blocklist --enable-zero-copy --enable-features=AcceleratedVideoDecodeLinuxGL --disable-features=UseChromeOSDirectVideoDecoder"

# Optional: Vulkan ANGLE backend (recommended for Wayland + modern GPUs)
#   PINOKIO_USE_VULKAN=1 pinokio
if [ "$PINOKIO_USE_VULKAN" = "1" ]; then
  GPU_FLAGS="$GPU_FLAGS --use-angle=vulkan --use-cmd-decoder=passthrough"
fi

# Optional: Disable GPU acceleration entirely (fallback for broken drivers or VMs)
#   PINOKIO_DISABLE_GPU=1 pinokio
if [ "$PINOKIO_DISABLE_GPU" = "1" ]; then
  GPU_FLAGS="--disable-gpu --disable-gpu-sandbox"
fi

# Usage from terminal:
#   pinokio                              # Default: GPU acceleration enabled
#   PINOKIO_USE_VULKAN=1 pinokio         # Enable Vulkan backend (Wayland + modern GPUs)
#   PINOKIO_DISABLE_GPU=1 pinokio        # Disable GPU acceleration (troubleshooting)

exec "$TARGET_BIN" $GPU_FLAGS "$@"
`

  fs.writeFileSync(exePath, wrapperScript, { mode: originalStat.mode || 0o755 })
}
