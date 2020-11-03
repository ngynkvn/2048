function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size = size; // Size of the grid
  this.inputManager = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator = new Actuator;

  this.startTiles = 2;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));
  this.inputManager.on("brute", this.brute.bind(this));

  this.setup();

  ai.setup(this);
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid = new Grid(previousState.grid.size,
      previousState.grid.cells); // Reload grid
    this.score = previousState.score;
    this.over = previousState.over;
    this.won = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid = new Grid(this.size);
    this.score = 0;
    this.over = false;
    this.won = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.grid.addRandomTile();
  }
};


// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score: this.score,
    over: this.over,
    won: this.won,
    bestScore: this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid: this.grid.serialize(),
    score: this.score,
    over: this.over,
    won: this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};


class AI {
  setup(game) {
    // Reference to game manager
    this.game = game;
  }

  // Basic Search Tree.
  brute_force(depth) {
    let directions = [0, 1, 2, 3];
    let state = this.game.serialize();
    let best_i = 0;
    let best_score = 0;
    let scores = directions.map(i => {
      let update = this.move(state, i);
      return this.track(update, depth);
    })
    scores.forEach((score, i) => {
      // Calculate the score for taking that move.
      if (score > best_score) {
        best_score = score;
        best_i = i;
      }
    });
    this.game.move(best_i);
  }

  // Probabilistic
  prob(depth) {
    let transitions = this.game.grid.possibleTransitions();
    let best_i = 0;
    let best_score = 0;
    scores = []
    scores.forEach((score, i) => {
      // Calculate the score for taking that move.
      if (score > best_score) {
        best_score = score;
        best_i = i;
      }
    });
    this.game.move(best_i);
  }



  track(state, depth) {
    if (depth == 0) {
      return state.score;
    } else {
      let directions = [0, 1, 2, 3];
      // Calculate the score for taking that move.
      let scores = directions.map(i => {
        let update = this.move(state, i);
        // Avoid losing.
        if (update.over){return 0;}
        return update.moved ? this.track(update, depth - 1) : update.score;
      });
      return Math.max(...scores);
    }
  }

  move(state, direction) {
    const grid = new Grid(state.grid.size, state.grid.cells)
    let update = grid.move(direction);
    return {
      ...state,
      ...update,
      score: state.score + update.score,
    }
  }

  heuristics(state) {
    const grid = new Grid(state.grid.size, state.grid.cells)
    // Check if we are building a nicely increasing board towards a corner.
    const monotonicity = 0;
    // Try and minimize the differences in neighboring edge weights.
    let smoothness = 0;
    grid.eachCell((x, y, t) => {
      if (!t) return;
      let neighbors = grid.cellNeighbors(x, y);
      for (neighbor of neighbors) {
        smoothness += Math.abs(t.value - neighbor.value);
      }
      // let emptyNeighbors = 4 - neighbors.length;
      // smoothness += (emptyNeighbors * t.value);
    })
    const free_tiles = grid.countEmpty();
    return { monotonicity, smoothness: -smoothness, free_tiles };
  }

}
const UP = 0;
const RIGHT = 1;
const DOWN = 2;
const LEFT = 2;
let ai = new AI();

GameManager.prototype.brute = function() {
  if(this.brute_running) {
    clearInterval(this.brute_running);
  } else {
    this.brute_running = setInterval(() => {ai.brute_force(5)}, 100);
  }
}

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.grid.findFarthestPosition(cell, vector);
        var next = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.grid.moveTile(tile, positions.farthest);
        }

        if (!self.grid.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.grid.addRandomTile();

    if (!this.grid.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0, y: -1 }, // Up
    1: { x: 1, y: 0 },  // Right
    2: { x: 0, y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};
Grid.prototype.getVector = GameManager.prototype.getVector;

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};
Grid.prototype.buildTraversals = GameManager.prototype.buildTraversals;


Grid.prototype.movesAvailable = function () {
  return this.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
Grid.prototype.tileMatchesAvailable = function () {
  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = this.getVector(direction);
          var cell = { x: x + vector.x, y: y + vector.y };

          var other = this.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

