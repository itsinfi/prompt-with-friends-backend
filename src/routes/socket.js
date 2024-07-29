// import { processPrompt } from "../../public/javascripts/ai-api"
const { isNumberObject } = require("util/types");
const dbHandler = require('../core/dbHandlers/dbHandler');
const gameAPI = require('../core/gameAPI/gameAPI');
const sendConnectionError = require('../routes/error/ConnectionError');

/**
 * object to store sessions (key) and array of players (value)
 */
playersInSession = {1: [], 2: [] }


/**
 * Validate sessionCode and playerNumber from handshake and initiate socket session details
 * 
 * @param {*} socket server side socket
 * @param {*} next next to pass new state
 * @returns next
 */
async function establishConnectionDetails(socket, next) {
    const sessionCode = socket.handshake.auth.sessionCode
    let playerNumber = socket.handshake.auth.playerNumber*1;

    const sessionInDb = await dbHandler.findSessionByCode(sessionCode);

    //check whether session exists
    if (sessionInDb) {
        socket.sessionCode = sessionCode

        //check if playerNumber is provided (otherwise generate new one)
        if ( playerNumber && !isNaN(playerNumber) ) {

            // check if playerNumber exists
            if (dbHandler.findPlayerInSession(sessionInDb, playerNumber)) {
                socket.playerNumber = playerNumber;
            }
            else {
                sendConnectionError(socket, "Spieler mit playerNumber existiert nicht in Session.");
            }
        } else {
            const createPlayer = await dbHandler.createPlayerInSession(sessionCode);
            const createdPlayer = createPlayer.player;
            socket.playerNumber = createdPlayer.playerNumber;
        }
    } else {
        sendConnectionError(socket, "Session mit sessionCode existiert nicht.");
    }

    return next()
}


/**
 * Handle connection
 * 
 * @param {*} socket server side socket
 * @param {*} io socket init (dont remove)
 */
function handleConnection(io, socket) {

    // add socket to sessionCode group
    socket.join(socket.sessionCode);

    // set status of player to connected
    dbHandler.updatePlayerStatus(socket.sessionCode, socket.playerNumber, isConnected = true)

    //Send feedback on connected session
    sendConnectionFeedback(socket)

    gameAPI.initRound(io, socket);

    gameAPI.handlePrompt(io, socket);
    gameAPI.receiveVote(io, socket);

    //Handle update in players of session
    transmitPlayers(socket);
    
    //Handle disconnect
    handleDisconnection(socket)

    console.log(`User${socket.playerNumber} connected!`);
}


/**
 * Send feedback on connected session
 * 
 * @param {*} socket server side socket
 */
async function sendConnectionFeedback(socket) {
    try {
        const session = await dbHandler.findSessionByCode(socket.sessionCode)
        const currentPlayer = dbHandler.findPlayerInSession(session, socket.playerNumber);

        socket.emit("connectionFeedback", {
            session: session,
            player: currentPlayer,
            players: session.players
        });
    } catch (error) {
        console.error(error)
    }
}

/**
 * handle disconnection of user
 * 
 * @param {*} socket server side socket
 */
function handleDisconnection(socket) {
    socket.on('disconnect', () => {
        console.log(`User${socket.playerNumber} disconnected!`);

        //Leave session
        socket.leave(socket.sessionCode);

        // update status of player
        dbHandler.updatePlayerStatus(socket.sessionCode, socket.playerNumber, isConnected = false);

        //Handle update in players of session
        transmitPlayers(socket)
    });
}

/**
 * send ui update of players in session to all connected sockets of the session
 * 
 * @param {*} socket server side socket
 */
async function transmitPlayers(socket) {
    try {
        const session = await dbHandler.findSessionByCode(socket.sessionCode)
        
        socket.to(socket.sessionCode).emit('updatePlayers', {
            players: session.players
        })
    } catch {
        // TODO: Error handling
    }
  }

//Export functionality to socket.io
module.exports = function (io) {

    //Find out session to connect to
    io.use((socket, next) => {
        establishConnectionDetails(socket, next)
    })
    
    //Handle socket connection
    io.on('connection', (socket) => {

        if (socket.sessionCode === undefined || null) {
            console.log('no session')
            sendConnectionError(socket, 'Session konnte nicht gefunden werden.')
        } else if (socket.playerNumber === undefined || null) {
            console.log('no playerNumber')
            sendConnectionError(socket, 'Authentifizierung war nicht möglich.')
        } else {
            handleConnection(io, socket)
        }
    });
};

/**
 * receives the prompt, sends it to openAI and sends result to frontend
 * 
 * @param {*} socket server side socket
 * @param {*} io socket init (dont remove)
 */