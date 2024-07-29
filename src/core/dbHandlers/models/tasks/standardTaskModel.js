const mongoose = require('mongoose');

const standardTaskSchema = mongoose.Schema({
  id:               { type: mongoose.Schema.Types.ObjectId, required: true },
  description : { type: String, required: true },
  tips:            [{ type: String, required: false }]
})

const StandardTask = mongoose.model('standardTask', standardTaskSchema );

module.exports = StandardTask;