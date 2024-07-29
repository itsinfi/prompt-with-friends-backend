// Function to generate a random string of specified length
function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function findSessionByCode( Session, sessionCode ) {
  return await Session.findOne({ sessionCode });
}

// Function to generate a unique session code
async function generateValidSessionCode( Session ) {
  let sessionCode;
  do {
    // Generate a random 6-character string
    sessionCode = generateRandomString(6);
    // Check if a session with this code exists
  } while (await findSessionByCode( Session, sessionCode )); // Loop until a unique code is found
  return sessionCode;
}

module.exports = { 
  generateRandomString,
  findSessionByCode,
  generateValidSessionCode,
};