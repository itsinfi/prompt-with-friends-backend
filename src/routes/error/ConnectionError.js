/**
 * handles procedure if an error in the connection occurs
 * 
 * @param {*} socket server side socket 
 * @param {*} msg error message to send
 */
function sendConnectionError(socket, msg) {
  socket.emit('error', {
      message: msg
  })
  socket.disconnect(true)
}

module.exports = sendConnectionError;