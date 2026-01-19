export function renderBoard(state) {
  const root = document.getElementById("board-root");
  root.innerHTML = `
    <h2>TrisTris</h2>
    <p>Griglia 3×3 con sottomatrici. La logica sarà implementata in seguito.</p>
  `;
}
