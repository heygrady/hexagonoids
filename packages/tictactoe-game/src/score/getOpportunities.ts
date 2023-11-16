interface Opportunities {
  combinations: number[][]
  corners: Set<number>
  edges: Set<number>
  diagonals: Set<number>
  centerSpace: number
}

export const opportunityMap = new Map<number, Opportunities>()

// export const getOpportunities = (boardSize: number): Opportunities => {
export const getOpportunities = (boardSize: number): Opportunities => {
  const cachedOpportunities = opportunityMap.get(boardSize)
  if (cachedOpportunities != null) {
    return cachedOpportunities
  }
  const response: Opportunities = {
    combinations: [],
    corners: new Set(),
    edges: new Set(),
    diagonals: new Set(),
    centerSpace: Math.floor((boardSize * boardSize) / 2),
  }

  // Rows and Columns
  for (let i = 0; i < boardSize; i++) {
    const row: number[] = []
    const col: number[] = []
    for (let j = 0; j < boardSize; j++) {
      const rowIndex = i * boardSize + j
      const colIndex = j * boardSize + i
      row.push(rowIndex)
      col.push(colIndex)

      // Corners
      if (
        (i === 0 || i === boardSize - 1) &&
        (j === 0 || j === boardSize - 1)
      ) {
        response.corners.add(rowIndex)
      }

      // Edges
      if (i === 0 || i === boardSize - 1 || j === 0 || j === boardSize - 1) {
        response.edges.add(rowIndex)
      }
    }
    response.combinations.push(row, col)
  }

  // Diagonals
  const diag1: number[] = []
  const diag2: number[] = []
  for (let i = 0; i < boardSize; i++) {
    const index1 = i * boardSize + i
    const index2 = i * boardSize + (boardSize - i - 1)
    diag1.push(index1)
    diag2.push(index2)
    response.diagonals.add(index1)
    response.diagonals.add(index2)
  }
  response.combinations.push(diag1, diag2)

  // Cache
  opportunityMap.set(boardSize, response)

  return response
}
