const express = require('express');
const router = express.Router();

/* GET REQUEST TEMPLATE. */
router.get('/', function(req, res, next) {
  res.json({"message": "this was a get request response"});
});

/* POST REQUEST TEMPLATE. */
router.post('/', function(req, res, next) {
  res.json({"message": "this was a post request response"});
});

module.exports = router;