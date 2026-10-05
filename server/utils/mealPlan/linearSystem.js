// Pivots smaller than this mean the system has no single solution.
const PIVOT_EPSILON = 1e-12;

/**
 * Solve `matrix · x = rhs` by Gauss-Jordan elimination with partial pivoting.
 * Returns x, or null when the system is singular.
 */
function solveLinearSystem(matrix, rhs) {
  const size = rhs.length;
  const rows = matrix.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < size; col++) {
    const pivot = largestPivotRow(rows, col);
    if (Math.abs(rows[pivot][col]) < PIVOT_EPSILON) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    eliminateColumn(rows, col);
  }
  return rows.map((row, i) => row[size] / row[i]);
}

// The row at or below `col` with the largest value in that column.
function largestPivotRow(rows, col) {
  let best = col;
  for (let row = col + 1; row < rows.length; row++) {
    if (Math.abs(rows[row][col]) > Math.abs(rows[best][col])) best = row;
  }
  return best;
}

// Zero out `col` in every row except the pivot row.
function eliminateColumn(rows, col) {
  const size = rows.length;
  for (let row = 0; row < size; row++) {
    if (row === col) continue;
    const factor = rows[row][col] / rows[col][col];
    for (let k = col; k <= size; k++) rows[row][k] -= factor * rows[col][k];
  }
}

module.exports = { solveLinearSystem };
