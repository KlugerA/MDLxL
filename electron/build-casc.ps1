$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$target = Join-Path $PSScriptRoot 'casc\CascBridge-0.7.0.exe'
& $compiler /nologo /platform:x64 /target:exe "/out:$target" (Join-Path $PSScriptRoot 'CascBridge.cs')
if ($LASTEXITCODE -ne 0) { throw 'CASC helper compilation failed.' }
