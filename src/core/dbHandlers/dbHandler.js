// libs
const mongoose = require('mongoose');
const sanitize = require('mongo-sanitize');

const Session = require('./models/sessionModel.js');
const StandardGameModel = require('./models/gamemodes/standardGameModel.js');
const StandardTask = require('./models/tasks/standardTaskModel.js');



// utils
const { generateValidSessionCode } = require('./utils.js');

/**
 * Connects Mongoose to the MongoDB
 * @param {String} mongoURI The mongodb URI to connect to
 */
async function connect(mongoURI) {
  try {
    // trying to connect to DB using URI from config file
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error(err);
  }
}

/**
 * Creates a Session with an initial Player, who is host
 * @param {String} playerName (opt.) Set a playerName for the Host Player (default: Anonymus)
 * @param {String} gameMode  (opt.) Set the gamemode (default: default)
 * @returns Returns the saved Session Document
 * @throws
 */
async function createSessionWithHostPlayer(playerName = "Anonymus", gameMode = "default") {
  try {
    // Create valid Session Code
    const validSessionCode = await generateValidSessionCode(Session);

    sanitize(playerName);
    sanitize(gameMode);
    
    // Create a new session document
    const newSession = new Session({
      sessionCode: validSessionCode,
      players: [{ name: playerName, isHost: true }], // Add host player
      mode: gameMode // Set game mode
    });

    // Save the new session to the database
    const savedSession = await newSession.save();

    console.log('Session created with host player:', savedSession);
    return savedSession;
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

/**
 * Create a new Player in a given Session
 * @param {String} sessionCode Required Session Code
 * @param {String} playerName (opt.) Player name for the new Player (default Anonymus)
 * @returns Returns an object with attributes player and session, which were just saved to DB
 * @throws
 */
async function createPlayerInSession(sessionCode, playerName = "Anonymus") {
  try {
    const session = await findSessionByCode(sessionCode);

    sanitize(playerName);

    // Create a new player document
    const newPlayer = {
      name: playerName,
      isConnected: false,
    };

    // Add the new player to the session
    session.players.push(newPlayer);

    // Save the updated session
    const savedSession = await session.save();

    // Retrieve the newly added player
    const savedPlayer = savedSession.players.reduce((latestPlayer, currentPlayer) => {
      return (latestPlayer.playerNumber > currentPlayer.playerNumber) ? latestPlayer : currentPlayer;
    });

    console.log('Player joined session:', savedSession);

    // Return the session and the newly created player
    return { session: savedSession, player: savedPlayer };
  } catch (error) {
    console.error('Error joining session:', error);
    throw error;
  }
}

/**
 * Retrieves a Session by it's sessionCode
 * @param {String} sessionCode Required sessionCode 
 * @returns Returns the correct session
 * @throws Throws an error if unsuccessfull
 */
async function findSessionByCode(sessionCode) {
  try {
    sanitize(sessionCode);
    const session = await Session.findOne({ sessionCode });
    return session || false;
  } catch (error) {
    console.error('Error finding session by code:', error);
    throw error;
  }
}

function findPlayerInSession(session, playerNumber) {
  try {
    return session.players.find(player => player.playerNumber == playerNumber);
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * Gets an array of the most recent results from each player
 * @param {String} sessionCode 
 * @param {Number} roundNumber 
 * @returns [{ playerNumber: 1, result: RESULT_MODEL }, { playerNumber: 2, result: RESULT_MODEL } ...]
 * @throws {Error}
 */
async function findLatestResultPerPlayer(sessionCode, roundNumber = null) {
  try {
    // Retrieve the session by session code
    const currentSession = await findSessionByCode(sessionCode);

    sanitize(roundNumber);

    // If roundNumber is not provided, get the active round
    if (roundNumber === null) { roundNumber = currentSession.gamestate.activeRound}

    const round = currentSession.gamestate.rounds[roundNumber];
    if (!round) { throw new Error(`Round number ${roundNumber} not found in session`)}

    // Retrieve the latest result for each player
    const latestResults = currentSession.players.map(player => {
      const playerResults = round.results
        .filter(result => result.playerNumber === player.playerNumber)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort in descending order by timestamp
      
      return { playerNumber: player.playerNumber, result: playerResults[0] || null }; // Get the latest result or null if none found
    });

    return latestResults;

  } catch (error) {
    console.error("Error finding latest result per player:", error);
    throw error;
  }
}

/**
 * Updates the isConnected status of a player
 * @param {String} sessionCode Required Session Code
 * @param {String} playerNumber Required Player Number
 * @param {Boolean} isConnected New Status
 * @returns Returns an Object with the saved Player and Session (attributes session and player)
 */
async function updatePlayerStatus(sessionCode, playerNumber, isConnected) {
  try {
    const currentSession = await findSessionByCode(sessionCode);

    sanitize(playerNumber);
    sanitize(isConnected);

    const currentPlayer = findPlayerInSession(currentSession, playerNumber);

    if (!currentPlayer) {
      console.error('Error: Player not found');
      throw new Error('Player not found');
    }

    currentPlayer.isConnected = isConnected;

    // Save the updated session
    const savedSession = await currentSession.save();

    console.log('Player status updated:', currentPlayer);
    return { session: savedSession, player: currentPlayer };

  } catch (error) {

    console.error('Error updating player status:', error);
    // throw error;
  }
}

/**
 * Increments the score of a given player
 * @param {String} sessionCode 
 * @param {String} playerNumber 
 * @param {Number} increment 
 */
async function incrementPlayerScore(sessionCode, playerNumber, increment) {
  try {
    const currentSession = await findSessionByCode(sessionCode);
    const currentPlayer = findPlayerInSession(currentSession, playerNumber);
    currentPlayer.score = currentPlayer.score + increment;
    await currentSession.save();
  } catch (error) {
    console.error(`Error incrementing score: ${error}`)
  }
}

/**
 * Save a prompt result 
 * @param {String} sessionCode Required session code
 * @param {Number} round  Required round index
 * @param { {String, Number, String} } result The resultobject with prompt, playerNumber and reult 
 * @throws
 */
async function savePromptResult(sessionCode, round, { prompt, playerNumber, result }) {
  try {
    sanitize(prompt);
    sanitize(result);

    const newResult = { prompt, playerNumber, result };
    const currentSession = await findSessionByCode(sessionCode);

    // push the new Result to the round in given session
    currentSession.gamestate.rounds[round].results.push(newResult);
    currentSession.save();
  } catch (error) {
    console.error("Error saving prompt result: ", error);
    throw error;
  }
}

/**
 * Selects a new random Task and writes it in the used tasks. Returns the selected to task for further handling
 * @param {Session} currentSession 
 * @returns selected Task
 */
async function selectAndStoreNewTask(currentSession) {
  try {
    // this function can be handled diffrently based on game mode
    switch (currentSession.mode) {
      case 'default':
        {
          const usedTaskIds = currentSession.gamestate.usedTasks;

          // Get tasks that aren't used yet
          let remainingTasks = await StandardTask.find({ _id: { $nin: usedTaskIds } });

          // When all tasks are used, reset used tasks and set remainingTasks to all Tasks
          if (remainingTasks.length === 0) {
            currentSession.gamestate.usedTasks = [];
            await currentSession.save();
            remainingTasks = await StandardTask.find({});
          }

          // If there are no Tasks, the task collection must be empty. Fallback to this task and return
          if (remainingTasks.length === 0) {
            return {
              description: 'Default fallback task',
              tips: ['No specific tips available'],
            };
          }

          // chose a random Task
          const randomTask = remainingTasks[Math.floor(Math.random() * remainingTasks.length)];

          // save the tasks ID to used Task
          currentSession.gamestate.usedTasks.push(randomTask._id);
          await currentSession.save();

          // return selected task data
          return {
            description: randomTask.description,
            tips: randomTask.tips,
          };
        }
      default:
        throw new Error(`Mode ${mode} not supported`);
    }
  } catch (error) {
    console.error(`Error selecting and storing new task: ${error}`);
    throw error;
  }
}



/**
 * Creates a new empty round
 * @param {String} sessionCode Required session Code
 * @throws 
 */
async function createNewRound(sessionCode) {
  try {
    const currentSession = await findSessionByCode(sessionCode);
    
    const newTask = await selectAndStoreNewTask(currentSession);

    const newRound = {
      task: {
        description:  newTask.description,
        tips:        newTask.tips
      }
    };

    // push the new Result to the round in given session
    if (currentSession) {
      currentSession.gamestate.rounds.push(newRound);
      await currentSession.save();
    } else {
      throw new Error(`No session found with sessionCod: ${sessionCode}`)
    }
    
  } catch(error) {
    console.error("Error creatin Round: ", error);
    throw error;
  }
}

/**
 * Get the current activeRound of a Session by providing the SessionCode
 * @param {String} sessionCode 
 * @returns {Number, null} Is Null if unset or game must be finished
 */
async function getActiveRound(sessionCode) {
  try {
    const currentSession = await findSessionByCode(sessionCode);
    return currentSession.gamestate.activeRound;
  } catch (error) {
    console.error(`Error getting activeRound of ${sessionCode}: ${error}`);
    return error;
  }
}

/**
 * Sets the active round 
 * @param {String} sessionCode 
 * @param {Number, null} roundNumber Set to null if you want to unset.
 * @returns {error} If Error is encountered
 */
async function setActiveRound(sessionCode, roundNumber) {
  try {
    const currentSession = await findSessionByCode(sessionCode);
    currentSession.gamestate.activeRound = roundNumber;
    await currentSession.save();
    return true;
  } catch (error) {
    console.error(`Error setting activeRound for ${sessionCode}: ${error}`);
    return error;
  }
}

/**
 * Gets The RoundPhase
 * @param {String} sessionCode 
 * @returns 
 */
async function getRoundPhase(sessionCode) {
  try {
    const currentSession = await findSessionByCode(sessionCode)
    return currentSession.gamestate.roundPhase
  } catch (error) {
    console.error(`Error getting roundPhase: ${error}`)
  }
}

/**
 * Sets the roundPhase
 * @param {String} sessionCode 
 * @param {Number} roundPhase 
 * @returns 
 */
async function setRoundPhase(sessionCode, roundPhase) {
  try {
    const currentSession = await findSessionByCode(sessionCode);
    currentSession.gamestate.roundPhase = roundPhase;
    await currentSession.save();
    return true;
  } catch (error) {
    console.error(`Error setting roundPhase for ${sessionCode}: ${error}`);
    return error;
  }
}

/**
 * Gets votes
 * @param {String} sessionCode 
 * @param {Number} roundNumber 
 * @returns {Array} votes 
 */
async function getVotes(sessionCode, roundNumber) {
  try {
    const currentSession = await findSessionByCode(sessionCode);
    if(!currentSession) {throw new Error(`Couldn\'t retrieve Session #${sessionCode}`)};
    
    return currentSession.gamestate.rounds[roundNumber].votes;
  } catch (error) {
    console.error(`Error getting Votes for #${sessionCode} round ${roundNumber}: ${error}`)
  }
}

/**
 * Sets a vote for a playerNumber to a playerNumber
 * @param {String} sessionCode 
 * @param {Number} roundNumber 
 * @param {Number} voter 
 * @param {Number} voted 
 * @returns 
 */
async function setVote(sessionCode, roundNumber, voter, voted) {
  try {
    const currentSession = await findSessionByCode(sessionCode);
    if(!currentSession) {throw new Error(`Couldn\'t retrieve Session #${sessionCode}`)};
    
    const currentRound = currentSession.gamestate.rounds[roundNumber];
    if(!currentRound) {throw new Error(`Couldn\'t retrieve round ${roundNumber} of Session #${sessionCode}`)};
    
    // if Voter has already voted, update his vote
    for(let vote of currentRound.votes) {
      if(vote.voter === voter) { 
        vote.voted = voted;
        await currentSession.save();
        return currentRound.votes;  
      }
    }

    // when Voter has not been updated, a new vote is pushed
    currentRound.votes.push({voter: voter, voted: voted});
    await currentSession.save();
    return currentRound.votes;

  } catch (error) {
    console.error(`Error setting Votes for #${sessionCode} round ${roundNumber}: ${error}`)
  }
}

/**
 * Deletes Sessions that are older than x minutes
 * @param {Number} minutes 
 * @returns {error} if encountered
 */
async function deleteSessionsOlderThan(minutes) {
  if (typeof minutes == "undefined") {
    console.error("Duration for session deletion must be set!");
    return null;
  }

  if (minutes <= 0 || isNaN(minutes)) {
    console.error("Duration for session deletion must be greater than 0 minutes!");
    return null;
  }

  const threshold = new Date(Date.now() - (minutes * 60 * 1000)); // Convert minutes to milliseconds
  try {
    const result = await Session.deleteMany({ timestamp: { $lt: threshold } });
    console.log(`Deleted ${result.deletedCount} old sessions.`);
  } catch (error) {
    console.error('Error deleting old sessions:', error);
    throw error;
  }
}

/**
 * Returns the highest Index in the rounds array
 * @param {String} sessionCode 
 * @returns 
 * @deprecated Use dbHandler.getActiveRound(sessionCode) instead
 */
async function findLatestRoundIndex(sessionCode) {
  try {
    const latestRound = await Session.findOne({ sessionCode });

    roundIndex = latestRound.gamestate.rounds.length - 1;

    return roundIndex;
  } catch (error) {
    console.error("Error finding latest round: ", error);
    throw error;
  }
}

module.exports = {
  connect,
  createSessionWithHostPlayer,
  createPlayerInSession,
  findSessionByCode,
  findPlayerInSession,
  findLatestResultPerPlayer,
  updatePlayerStatus,
  incrementPlayerScore,
  savePromptResult,
  createNewRound,
  deleteSessionsOlderThan,
  setActiveRound,
  getActiveRound,
  getRoundPhase,
  setRoundPhase,
  getVotes,
  setVote
}