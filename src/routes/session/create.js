const express = require('express');
const router = express.Router();
const { createSessionWithHostPlayer } = require('../../core/dbHandlers/dbHandler');
router.use(express.json());

router.post('/', async function(req, res, next) {
  // If playerName is defined in post body JSON, use that. OR if not, use a default value
  const playerName = req.body.name || "Anonymus";
  let newSession = await createSessionWithHostPlayer(playerName);
  res.json(newSession);
});

module.exports = router;