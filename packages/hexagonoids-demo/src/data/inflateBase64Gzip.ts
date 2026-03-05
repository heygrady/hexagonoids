export async function inflateBase64Gzip(base64: string): Promise<string> {
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  void writer.write(bytes).then(() => writer.close())
  return new Response(ds.readable).text()
}
