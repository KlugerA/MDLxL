# Native CASC reader

CascLib by Ladislav Zezula, MIT license (included). Native x64 build, file version 1.50.0.206.

Binary source: https://github.com/Darithos/W3ModelViewer/blob/a67661aecc3d04b2a6f9ed4b80a5c657183d1e6d/native/CascLib.dll

Upstream: https://github.com/ladislav-zezula/CascLib

SHA-256: bf813181374b7b2e88de509d29081153af8ea8922a36df48b87d6d9198063944

CascBridge-0.7.0.exe is compiled from ../CascBridge.cs using the Windows .NET Framework C# compiler. Boolean return values explicitly use I1 to match native C++ bool. The helper opens local storage, uses strict data checks, reads requested texture paths, and never calls online storage APIs. It is hidden and exits after 15 seconds idle.

The integrated texture library additionally uses CascFindFirstFile / CascFindNextFile to enumerate source filenames and their content keys. The bridge reads the documented leading filename/CKey fields from an oversized native buffer, avoiding version-specific trailing structure layouts. These indexes are cached per installation/build and enumeration occurs only when opening the library. Content-key lookup uses CASC_OPEN_BY_CKEY with strict data checks.

The versioned helper filename lets the Desktop application update without replacing an executable held by an already-running editor. Older helpers are retained.
