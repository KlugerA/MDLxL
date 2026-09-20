param(
  [Parameter(Mandatory=$true)][string]$WhiteoutRoot,
  [Parameter(Mandatory=$true)][string]$Emcc,
  [string]$OutputDirectory = 'work/whiteout'
)
$ErrorActionPreference = 'Stop'
# Link the MDLxL adapter against WhiteoutLib 38d279c, built with Emscripten.
New-Item -ItemType Directory -Force $OutputDirectory | Out-Null
# Keep Embind's wrappers compatible with the packaged renderer's strict CSP.
# wasm-unsafe-eval allows WebAssembly compilation, not new Function / eval.
& $Emcc native/paint-blp-bindings.cpp "$WhiteoutRoot/build-mdlxl/libwhiteout_lib.a" "-I$WhiteoutRoot/include" -O3 -std=c++20 --bind -fwasm-exceptions -sDYNAMIC_EXECUTION=0 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=MDLxLPaintBlp -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=32MB -sMAXIMUM_MEMORY=512MB '-sENVIRONMENT=web,worker,node' -sNO_EXIT_RUNTIME=1 -sFILESYSTEM=0 '-sEXPORTED_RUNTIME_METHODS=getExceptionMessage,decrementExceptionRefcount' -o "$OutputDirectory/whiteout-paint-blp.js"
if ($LASTEXITCODE -ne 0) { throw 'Whiteout adapter build failed.' }

