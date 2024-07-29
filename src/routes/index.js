var express = require('express');
var router = express.Router();

/* GET REQUEST TEST. */
router.get('/', function (req, res, next) {
  // res.send({ 'message': 'hello world!' });
  res.sendFile(__dirname + '/chat/chat.html')
});

/* POST REQUEST TEST. */
router.post('/', function(req, res, next) {
  res.json({ 'message': 'uwu' });
});

module.exports = router;
