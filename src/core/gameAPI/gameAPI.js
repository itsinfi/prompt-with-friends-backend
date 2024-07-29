const sendConnectionError = require('../../routes/error/ConnectionError');
const dbHandler = require('../../core/dbHandlers/dbHandler');
const processPrompt = require("../../core/ai-api/ai-api");
const config = require("../../../config.json");

/**
 * creates first round and starts game state management
 * 
 * @param {*} io socket init (dont remove)
 * @param {*} socket server side socket
 */
async function initRound(io, socket) {
  socket.on('initRound', async () => {
      try {
          if (await dbHandler.getActiveRound(socket.sessionCode) == null) {
              await dbHandler.createNewRound(socket.sessionCode);
              await dbHandler.setActiveRound(socket.sessionCode, 0);
          } else {
              error = "Konnte keine Runde für die Session " + socket.sessionCode + " initialisieren, weil schon eine Runde existiert!";
              sendConnectionError(socket, error);
          }
      } catch {
          sendConnectionError(socket, 'Konnte Runde nicht erstellen');
      }

      stateManager(io, socket);
  });
}

/**
 * starts a new round
 * 
 * @param {*} io socket init (dont remove)
 * @param {*} socket server side socket
 */
async function startNewRound(io, socket) {
  await dbHandler.createNewRound(socket.sessionCode);
}

/**
 * starts a listener to receive Votes from frontend
 * 
 * @param {*} io socket init (dont remove)
 * @param {*} socket server side socket
 */
async function receiveVote(io, socket) {
  // listen for votes
  socket.on('receiveVote', async ({voted}) => {
      // check if current phase is voting phase
      if (await dbHandler.getRoundPhase(socket.sessionCode) === 1) {
        // set vote
        dbHandler.setVote(socket.sessionCode, await dbHandler.getActiveRound(socket.sessionCode), socket.playerNumber, voted);
      }
        });
}

/**
 * starts a listener to receive and handle prompts
 * 
 * @param {*} io socket init (dont remove)
 * @param {*} socket server side socket
 */
async function handlePrompt(io, socket) {
  // listen for prompts
  socket.on('sendPrompt', async ({prompt}) => {
    // check if current phase is prompting phase, reject request if not
      if (await dbHandler.getRoundPhase(socket.sessionCode) === 0)  {

        // get round the processPrompt function should save the result to
        round = await dbHandler.getActiveRound(socket.sessionCode);

        // get prompt result and save it to db
        const data = processPrompt(prompt, socket.playerNumber, socket.sessionCode, round);

        // send result to frontend
        data.then((message) => {
            // processprompt returns false if the result came in after the prompting phase ended and refuses to save the result to db
            if (message!=false) {
              io.to(socket.id).emit('sendPrompt', { timestamp: String(Date.now()), result: message});
            } else {
              io.to(socket.id).emit('sendPrompt', { timestamp: String(Date.now()), alert: "Dein Ergebnis kam leider zu spät zurück. Bitte schicke deine Prompts rechtzeitig ab, damit sie in die Abstimmungsphase mitaufgenommen werden können."});
            }
            
        }).catch((errorMessage) => {
            console.log('An error occured while sending prompt and results to fe! See below:');
            console.log(errorMessage);
        });
    } else {
      io.to(socket.id).emit('sendPrompt', { timestamp: String(Date.now()), alert: "Prompts können nur während der Prompting-Phase eingereicht werden!"});
    }

  });
}

/**
 * increases score of players according to how many votes they got in current round
 * 
 * @param {*} socket server side socket
 */
async function handlePlayerScores(socket) {
  // get votes - who voted for whom?
  const votes = await dbHandler.getVotes(socket.sessionCode, await dbHandler.getActiveRound(socket.sessionCode));

  try {
    // increment score of player by one for each player who voted for them in this round
    for (const vote of votes) {
      await dbHandler.incrementPlayerScore(socket.sessionCode, vote.voted, 1);
    }
  } catch(error) {
    console.log("Couldn't increment player score: " + error);
  }
  
}

/**
 * send ui update of session to all sockets connected to session
 * 
 * @param {*} socket server side socket
 */
async function transmitSession(io, socket) {
  try {
      const session = await dbHandler.findSessionByCode(socket.sessionCode)

      io.to(socket.sessionCode).emit('updateSession', {
          session: session,
      });
  } catch (error) {
      console.error(error)
  }
}

/**
 * sends session in initial state to frontend and starts game loop
 * 
 * @param {*} io socket init (dont remove)
 * @param {*} socket server side socket
 */
async function stateManager(io, socket) {
  // change ronud phase from null to 0
  await dbHandler.setRoundPhase(socket.sessionCode, 0);

  // transmit session
  transmitSession(io, socket);

  // get timeLimit for (initial) prompting phase and start game loop that toggles the phases
  timeLimit = config.timer_prompting;
  recursivePhaseHandler(io, socket, timeLimit);

}

/**
 * Runs a timer, toggles phases and informs frontend about the timer, sends session after every phase change
 * 
 * @param {*} io socket init (dont remove)
 * @param {*} socket server side socket
 * @param {*} time current time left
 */
async function recursivePhaseHandler(io, socket, time) {
  // stop game loop if session doesn't exist anymore
  if(!( await dbHandler.findSessionByCode(socket.sessionCode))) {
    return;
  }

  // save current round and phase for better readability
  let activeRound = await dbHandler.getActiveRound(socket.sessionCode);
  let currentPhase = await dbHandler.getRoundPhase(socket.sessionCode);

  // start timeout to wait one second
  setTimeout(async ()=> {
    if (time>0) {
      // send timer and decrease
      io.to(socket.sessionCode).emit('timer', { time: time });
      time--;
      recursivePhaseHandler(io, socket, time)
    } else if (time===0) {
        if (currentPhase === 2) {
            // start next round
            await startNewRound(io, socket);
            await dbHandler.setActiveRound(socket.sessionCode, activeRound+1);

            await dbHandler.setRoundPhase(socket.sessionCode, 0);

            // get timer for prompting phase of next round
            time = config.timer_prompting;
            // send updated Session
            transmitSession(io, socket);
            // start next iteration
            recursivePhaseHandler(io, socket, time);
            
        } else {

            if (currentPhase === 1) {
              // get timer for leaderboard phase and increase player scores
              time = config.timer_leaderboard;        
              await handlePlayerScores(socket);
            } else {
              // get timer for voting phase
              time = config.timer_voting;
            }
            // increment round phase
            await dbHandler.setRoundPhase(socket.sessionCode, currentPhase+1);
            // send updated Session
            transmitSession(io, socket);
            // start next iteration
            recursivePhaseHandler(io, socket, time);
          }
            
        }
  }, 1000);
}

module.exports = {
  initRound,
  receiveVote,
  handlePrompt
};