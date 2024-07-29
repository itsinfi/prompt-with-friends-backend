const mongoose = require('mongoose');


const standardGameSchema = mongoose.Schema({
  promptAPI:    { type: String, required: true, default: 'gpt-3.5-turbo'},
  timerSeconds: { type: Number, required: true, default: 150},
})

const StandardGame = mongoose.model('standardGame', standardGameSchema );

module.exports = StandardGame