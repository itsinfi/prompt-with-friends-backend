const express = require('express');
const router = express.Router();
const { createPlayerInSession, updateStatus } = require('../../core/dbHandlers/dbHandler');
router.use(express.json());

// THIS IS FOR TEST PURPOSES ONLY AND WILL BE REMOVED

router.post('/', async function(req, res, next) {
  // If playerName is defined in post body JSON, use that. OR if not, use a default value
  const playerName = req.body.playerName || "Anonymus";
  const sessionCode = req.body.sessionCode || false;

  if( sessionCode ) {
    try {
      let newSession = await createPlayerInSession(sessionCode, playerName);
      res.json(newSession);
    } catch(error) {
      console.log(error);
      res.json({ "Error" : "Couldn't join session" })
    }
  } else {
    res.json({ "Error" : "No sessionCode specified!" });
  }
});

module.exports = router;