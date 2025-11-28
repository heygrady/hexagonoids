import fs from 'node:fs/promises'

export async function writeJsonFile(filePath: string, data: any) {
  try {
    const jsonData = JSON.stringify(data, null, 2)
    await fs.writeFile(filePath, jsonData, 'utf-8')
    // console.log(`JSON data has been written to the file: ${filePath}`)
  } catch (error) {
    console.error(
      'An error occurred while writing JSON data to the file:',
      error
    )
  }
}
