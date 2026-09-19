using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
// Local-only reader: base64 path lines in; READY, base64 bytes, -, or !base64 error out.
class CascBridge {
 [DllImport("CascLib.dll", CharSet=CharSet.Ansi, SetLastError=true)] [return: MarshalAs(UnmanagedType.I1)] static extern bool CascOpenStorage(string path, uint locales, out IntPtr storage);
 [DllImport("CascLib.dll", CharSet=CharSet.Ansi, SetLastError=true)] [return: MarshalAs(UnmanagedType.I1)] static extern bool CascOpenFile(IntPtr storage, string name, uint locale, uint flags, out IntPtr file);
 [DllImport("CascLib.dll", EntryPoint="CascOpenFile", SetLastError=true)] [return: MarshalAs(UnmanagedType.I1)] static extern bool CascOpenFileByKey(IntPtr storage, byte[] key, uint locale, uint flags, out IntPtr file);
 [DllImport("CascLib.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.I1)] static extern bool CascGetFileSize64(IntPtr file, out ulong size);
 [DllImport("CascLib.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.I1)] static extern bool CascReadFile(IntPtr file, byte[] buffer, uint size, out uint read);
 [DllImport("CascLib.dll")] [return: MarshalAs(UnmanagedType.I1)] static extern bool CascCloseFile(IntPtr file);
 [DllImport("CascLib.dll")] [return: MarshalAs(UnmanagedType.I1)] static extern bool CascCloseStorage(IntPtr storage);
 [DllImport("CascLib.dll", CharSet=CharSet.Ansi, SetLastError=true)] static extern IntPtr CascFindFirstFile(IntPtr storage, string mask, IntPtr data, string listFile);
 [DllImport("CascLib.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.I1)] static extern bool CascFindNextFile(IntPtr find, IntPtr data);
 [DllImport("CascLib.dll")] [return: MarshalAs(UnmanagedType.I1)] static extern bool CascFindClose(IntPtr find);
 static string TextureNames(IntPtr storage) {
  // All supported CascLib versions begin CASC_FIND_DATA with char szFileName[260].
  // Reserve extra space for the version-specific trailing fields; never marshal them.
  IntPtr data = Marshal.AllocHGlobal(2048), find = IntPtr.Zero;
  try {
   find = CascFindFirstFile(storage, "*", data, null);
   if (find == IntPtr.Zero || find == new IntPtr(-1)) throw new IOException("Cannot list Warcraft CASC files.");
   StringBuilder names = new StringBuilder(); int count = 0;
   do {
    string name = Marshal.PtrToStringAnsi(data) ?? "";
    string extension = Path.GetExtension(name).ToLowerInvariant();
    if (extension == ".blp" || extension == ".dds" || extension == ".tga" || extension == ".png" || extension == ".jpg" || extension == ".jpeg" || extension == ".webp") {
     if (++count > 300000) throw new IOException("Texture library exceeds its file limit.");
     // The stable CKey follows the 260-byte filename. Nested module filenames
     // are not always accepted by name lookup, but CKey lookup is unambiguous.
     byte[] key = new byte[16]; Marshal.Copy(IntPtr.Add(data,260),key,0,16);
     names.Append(name).Append('\t').Append(BitConverter.ToString(key).Replace("-", "")).Append('\n');
    }
   } while (CascFindNextFile(find, data));
   return names.ToString();
  } finally { if (find != IntPtr.Zero && find != new IntPtr(-1)) CascFindClose(find); Marshal.FreeHGlobal(data); }
 }
 static byte[] ReadKey(IntPtr storage, string hex) {
  if (hex.Length != 32) throw new IOException("Invalid texture content key.");
  byte[] key = new byte[16]; for (int i=0;i<16;i++) key[i]=Convert.ToByte(hex.Substring(i*2,2),16);
  IntPtr file; if (!CascOpenFileByKey(storage,key,0xffffffff,0x11,out file)) return null;
  try {
   ulong size; uint read;
   if (!CascGetFileSize64(file,out size) || size==0) return null;
   if (size>64*1024*1024) throw new IOException("Texture exceeds 64 MiB.");
   byte[] bytes=new byte[(uint)size];
   if (!CascReadFile(file,bytes,(uint)size,out read) || read!=(uint)size) throw new IOException("Incomplete CASC texture ("+Marshal.GetLastWin32Error()+").");
   return bytes;
  } finally { CascCloseFile(file); }
 }
 static int Main(string[] args) {
  IntPtr storage = IntPtr.Zero;
  try {
   if (!CascOpenStorage(args[0], 0xffffffff, out storage)) throw new IOException("Cannot open Warcraft CASC storage (" + Marshal.GetLastWin32Error() + ").");
   Console.WriteLine("READY");
   string line;
   while ((line = Console.ReadLine()) != null) {
    try {
     string name = Encoding.UTF8.GetString(Convert.FromBase64String(line)).Replace('/', '\\');
     if (name == "@textures") { Console.WriteLine(Convert.ToBase64String(Encoding.UTF8.GetBytes(TextureNames(storage)))); continue; }
     if (name.StartsWith("@ckey:")) { byte[] bytes=ReadKey(storage,name.Substring(6));Console.WriteLine(bytes==null?"-":Convert.ToBase64String(bytes));continue; }
     bool found = false;
     string dds = Path.ChangeExtension(name,".dds");
     string[] candidates = name.Contains(":") ? new [] { name, dds } : new [] { "war3.w3mod:" + name, "war3.w3mod:" + dds, name, dds };
     foreach (string candidate in candidates) {
      IntPtr file;
      if (!CascOpenFile(storage, candidate, 0xffffffff, 0x10, out file)) continue;
      try {
       ulong size64; uint read; if (!CascGetFileSize64(file, out size64)) throw new IOException("Cannot read CASC size: " + Marshal.GetLastWin32Error()); uint size = (uint)size64; if(size == 0) continue;
       if (size64 > 64 * 1024 * 1024) throw new IOException("Texture exceeds 64 MiB.");
       byte[] bytes = new byte[size];
       if (!CascReadFile(file, bytes, size, out read) || read != size) throw new IOException("Incomplete CASC texture (" + Marshal.GetLastWin32Error() + ").");
       Console.WriteLine(Convert.ToBase64String(bytes)); found = true; break;
      } finally { CascCloseFile(file); }
     }
     if (!found) Console.WriteLine("-");
    } catch (Exception e) { Console.WriteLine("!" + Convert.ToBase64String(Encoding.UTF8.GetBytes(e.Message))); }
   }
   return 0;
  } catch (Exception e) { Console.WriteLine("!" + Convert.ToBase64String(Encoding.UTF8.GetBytes(e.Message))); return 1; }
  finally { if (storage != IntPtr.Zero) CascCloseStorage(storage); }
 }
}




