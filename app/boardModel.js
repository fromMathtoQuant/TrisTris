export function getMicroBoardIndex(cellRow, cellCol, size = 3) {
  return cellRow * size + cellCol;
}

export function getMacroCellCoords(index, size = 3) {
  return {
    row: Math.floor(index / size),
    col: index % size
  };
}
