#!/usr/bin/env bash
# Puts the ONNX Runtime library the app bundles into src-tauri/onnxruntime/.
#
# Since November 2026 the archives of github.com/microsoft/onnxruntime/releases answer 404.
# The same library (same version, built by Microsoft) is inside the official Python wheels
# on PyPI: we take it from there, each wheel checked against its SHA-256.
#
#   scripts/onnxruntime.sh linux     -> libonnxruntime.so
#   scripts/onnxruntime.sh mac       -> libonnxruntime.dylib (universal: arm64 + x86_64)
#   scripts/onnxruntime.sh windows   -> onnxruntime.dll (processor only, no DirectML)
set -euo pipefail

ORT=1.23.2
PYPI=https://files.pythonhosted.org/packages
LINUX_WHL=ef/88/9cc25d2bafe6bc0d4d3c1db3ade98196d5b355c0b273e6a5dc09c5d5d0d5/onnxruntime-$ORT-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl
LINUX_SHA=0f9b4ae77f8e3c9bee50c27bc1beede83f786fe1d52e99ac85aa8d65a01e9b77
MAC_ARM_WHL=1b/9e/f748cd64161213adeef83d0cb16cb8ace1e62fa501033acdd9f9341fff57/onnxruntime-$ORT-cp312-cp312-macosx_13_0_arm64.whl
MAC_ARM_SHA=b8f029a6b98d3cf5be564d52802bb50a8489ab73409fa9db0bf583eabb7c2321
MAC_X86_WHL=91/9d/a81aafd899b900101988ead7fb14974c8a58695338ab6a0f3d6b0100f30b/onnxruntime-$ORT-cp312-cp312-macosx_13_0_x86_64.whl
MAC_X86_SHA=218295a8acae83905f6f1aed8cacb8e3eb3bd7513a13fe4ba3b2664a19fc4a6b
WIN_WHL=c0/b4/569d298f9fc4d286c11c45e85d9ffa9e877af12ace98af8cab52396e8f46/onnxruntime-$ORT-cp312-cp312-win_amd64.whl
WIN_SHA=25de5214923ce941a3523739d34a520aac30f21e631de53bba9174dc9c004435

sha() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
# fetch <path on PyPI> <sha256> <file inside the wheel> <output>
fetch() {
  curl -fsSL --retry 3 -o w.whl "$PYPI/$1"
  [ "$(sha w.whl)" = "$2" ] || { echo "SHA-256 inattendu pour $1" >&2; exit 1; }
  unzip -q -o -j w.whl "$3" -d .
  mv "$(basename "$3")" "$4"
  rm w.whl
}

out="$(pwd)/src-tauri/onnxruntime"
mkdir -p "$out"
tmp="$(mktemp -d)"
cd "$tmp"
case "${1:-}" in
  linux) fetch "$LINUX_WHL" "$LINUX_SHA" "onnxruntime/capi/libonnxruntime.so.$ORT" "$out/libonnxruntime.so" ;;
  mac)
    fetch "$MAC_ARM_WHL" "$MAC_ARM_SHA" "onnxruntime/capi/libonnxruntime.$ORT.dylib" arm64.dylib
    fetch "$MAC_X86_WHL" "$MAC_X86_SHA" "onnxruntime/capi/libonnxruntime.$ORT.dylib" x86_64.dylib
    lipo -create arm64.dylib x86_64.dylib -output "$out/libonnxruntime.dylib"
    lipo -info "$out/libonnxruntime.dylib" ;;
  windows) fetch "$WIN_WHL" "$WIN_SHA" "onnxruntime/capi/onnxruntime.dll" "$out/onnxruntime.dll" ;;
  *) echo "usage: $0 linux|mac|windows" >&2; exit 2 ;;
esac
cd / && rm -rf "$tmp"
ls -l "$out"
