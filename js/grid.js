function Grid(size, previousState) {
  this.size = size;
  this.cells = previousState ? this.fromState(previousState) : this.empty();
}

// Build a grid of the specified size
Grid.prototype.empty = function () {
  var cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(null);
    }
  }

  return cells;
};

// Move a tile and its representation
Grid.prototype.moveTile = function (tile, cell) {
  this.cells[tile.x][tile.y] = null;
  this.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Adds a tile in a random position
Grid.prototype.addRandomTile = function () {
  if (this.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.randomAvailableCell(), value);

    this.insertTile(tile);
  }
};

Grid.prototype.possibleTransitions = function () {
  [0, 1, 2, 3].map(direction => {
    const grid = new Grid(this.size, this.cells);
    grid.move(direction);
  })
}

Grid.prototype.move = function(direction) {
    var vector = this.getVector(direction);
    var traversals = this.buildTraversals(vector);
    var moved = false;
    var score = 0;

    // Traverse the grid in the right direction and move tiles
    traversals.x.forEach((x) => {
      traversals.y.forEach((y) => {
        let cell = { x: x, y: y };
        let tile = this.cellContent(cell);

        if (tile) {
          var positions = this.findFarthestPosition(cell, vector);
          var next = this.cellContent(positions.next);

          // Only one merger per row traversal?
          if (next && next.value === tile.value && !next.mergedFrom) {
            var merged = new Tile(positions.next, tile.value * 2);
            merged.mergedFrom = [tile, next];

            this.insertTile(merged);
            this.removeTile(tile);

            // Converge the two tiles' positions
            tile.updatePosition(positions.next);

            // Update the score
            score += merged.value;

            // The mighty 2048 tile
            if (merged.value === 2048) self.won = true;
          } else {
            this.moveTile(tile, positions.farthest);
          }

          if (!this.positionsEqual(cell, tile)) {
            moved = true; // The tile moved from its original cell!
          }
        }
      });
    });

    if (moved) {
      this.addRandomTile();
    }
    return {score, grid: this.serialize(), moved, over: !this.movesAvailable()};
}

Grid.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

Grid.prototype.fromState = function (state) {
  var cells = [];
  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      var tile = state[x][y];
      row.push(tile ? new Tile(tile.position, tile.value) : null);
    }
  }

  return cells;
};

// Find the first available random position
Grid.prototype.randomAvailableCell = function () {
  var cells = this.availableCells();

  if (cells.length) {
    return cells[Math.floor(Math.random() * cells.length)];
  }
};

Grid.prototype.availableCells = function () {
  var cells = [];

  this.eachCell(function (x, y, tile) {
    if (!tile) {
      cells.push({ x: x, y: y });
    }
  });

  return cells;
};

Grid.prototype.countEmpty = function () {
  let count = 0;
  this.eachCell((_x, _y, tile) => {
    if(tile) {
      count += 1;
    }
  });
  return count;
}

// Call callback for every cell
Grid.prototype.eachCell = function (callback) {
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      callback(x, y, this.cells[x][y]);
    }
  }
};

// Check if there are any cells available
Grid.prototype.cellsAvailable = function () {
  return !!this.availableCells().length;
};

// Check if the specified cell is taken
Grid.prototype.cellAvailable = function (cell) {
  return !this.cellOccupied(cell);
};

Grid.prototype.cellOccupied = function (cell) {
  return !!this.cellContent(cell);
};

Grid.prototype.cellContent = function (cell) {
  if (this.withinBounds(cell)) {
    return this.cells[cell.x][cell.y];
  } else {
    return null;
  }
};

// Inserts a tile at its position
Grid.prototype.insertTile = function (tile) {
  this.cells[tile.x][tile.y] = tile;
};

Grid.prototype.removeTile = function (tile) {
  this.cells[tile.x][tile.y] = null;
};

Grid.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.withinBounds(cell) &&
    this.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

Grid.prototype.withinBounds = function (position) {
  return position.x >= 0 && position.x < this.size &&
         position.y >= 0 && position.y < this.size;
};

Grid.prototype.serialize = function () {
  var cellState = [];

  for (var x = 0; x < this.size; x++) {
    var row = cellState[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(this.cells[x][y] ? this.cells[x][y].serialize() : null);
    }
  }

  return {
    size: this.size,
    cells: cellState
  };
};
