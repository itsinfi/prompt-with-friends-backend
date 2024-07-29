const mongoose = require('mongoose');

const StandardTask = require('../models/tasks/standardTaskModel');

// Schema for the player
const playerSchema = new mongoose.Schema({
  playerId:     { type: mongoose.Schema.Types.ObjectId },
  playerNumber: { type: Number, index: true },
  name:         { type: String, required: true },
  isHost:       { type: Boolean, required: false },
  isConnected:  { type: Boolean, required: true, default: false },
  score:        { type: Number, required: true, default: 0 },
});

// Handle the playerNumber before saving a Player
playerSchema.pre('save', async function(next) {
  if (this.playerNumber != null) {
    // If playerNumber is already set, skip this hook
    return next();
  }
  
  try {
    // Get the parent session document
    const session = this.parent().parent();

    if (session && session.players) {
      // Find the maximum playerNumber within the session's players array
      const maxPlayerNumber = session.players.reduce((max, player) => {
        return player.playerNumber > max ? player.playerNumber : max;
      }, 0);

      // Set the playerNumber for the new player
      this.playerNumber = maxPlayerNumber + 1;
    } else {
      // If no players exist, start with playerNumber 1
      this.playerNumber = 1;
    }

    next();
  } catch (error) {
    next(error);
  }
});

const resultSchema = new mongoose.Schema({
  timestamp:    { type: Date, required: true, default: Date.now },
  prompt:       { type: String, required: true },
  playerNumber: { type: Number, required: true },
  result:       { type: String }
});

const roundSchema = new mongoose.Schema({
  // Here are common fields shared between roundShemas for diffrent game modes
  timestamp: { type: Date, required: true, default: Date.now },
  results: [{ type: resultSchema }],
  votes: [{ voter: {type: Number}, voted: {type: Number}}]
}, { strict: false }); // disableing strict mode, this is not optimal but I really don't know how else I can implement gamemode specific rounds other than saying: Go Ham with these fields...

// Schema for the Session containing the player and rounds 
const sessionSchema = new mongoose.Schema({
  sessionId:    { type: mongoose.Schema.Types.ObjectId },
  sessionCode:  { type: String, index: true, unique: true },
  timestamp:    { type: Date, required: true, default: Date.now, index: true },
  players:      [ playerSchema ],
  mode:         { type: String, required: true, default: "default" }, //This field is used to determine which roundSchema is used
  gamestate: {
    activeRound:  { type: Number, default: null },
    roundPhase:   { type: Number, default: null },
    rounds:       [ 
      { 
        type: roundSchema
      } 
    ],
    usedTasks: [{ 
      type: mongoose.Schema.Types.ObjectId,
      // This references based on the gamemode... since there is only default right now, it always references to standardTasks
      refPath: 'mode == default ? "StandardTask" : "StandardTask"'
    }]
  }
});

// Creating the Session Model
const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;