//Handle chat message
function handleChatMessage(io, socket) {
    //Synchronize client update with other clients
    socket.on('chat message', (msg) => {
        io.to(`room ${socket.sessionID}`).emit('chat message', {timestamp: String(Date.now()), message: msg, isPrivate: false});
    });
}

//Send private welcome message
function sendPrivateMessage(io, socket) {
    io.to(socket.id).emit('chat message', { timestamp: String(Date.now()), message: `Welcome User${socket.userID}!`, isPrivate: true})
}

//frontend submits prompt
function receivePrompt(socket) {
    socket.on('receive prompt', (data) => {

        //how to handle prompt (with db and open ai request)
        processPrompt(data, socket.id, io)
    });   
}

//send prompt from backend to frontend after finishing processPrompt()
function sendPrompt(io, socketID, result) {
    io.to(socketID).emit('send prompt', {result: result});
}


module.exports = {
    handleChatMessage: handleChatMessage,
    sendWelcomeMessage: sendPrivateMessage
};