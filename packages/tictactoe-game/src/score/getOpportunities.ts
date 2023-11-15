export const opportunityMap = new Map<number, number[][]>()

export const getOpportunities = (boardSize: number): number[][] => {
  const cachedCombinations = opportunityMap.get(boardSize)
  if (cachedCombinations != null) {
    return cachedCombinations
  }
  const combinations: number[][] = []

  // Rows
  for (let i = 0; i < boardSize; i++) {
    const row: number[] = []
    for (let j = 0; j < boardSize; j++) {
      row.push(i * boardSize + j)
    }
    combinations.push(row)
  }
  // Columns
  for (let i = 0; i < boardSize; i++) {
    const col: number[] = []
    for (let j = 0; j < boardSize; j++) {
      col.push(i + j * boardSize)
    }
    combinations.push(col)
  }

  // Diagonals
  const diag1: number[] = []
  const diag2: number[] = []
  for (let i = 0; i < boardSize; i++) {
    diag1.push(i * boardSize + i)
    diag2.push(i * boardSize + (boardSize - i - 1))
  }

  opportunityMap.set(boardSize, combinations)
  return combinations
}
