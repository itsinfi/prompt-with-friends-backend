//Imports & Dependencies
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const http = require('http')
const https = require('https')
const socketIo = require('socket.io')
const cors = require('cors');
const fs = require('fs').promises;

//read config
const config = require('../config.json');

// Connect DB
const dbHandler = require('./core/dbHandlers/dbHandler');
dbHandler.connect(config.mongo_URI);

//Init app + server
const app = express();
const server = config.secure ? https.createServer(app) : http.createServer(app);


//Config for Cors
const corsConfig = {
  origin: config.fe_host,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept"],
  credentials: true
}

//Init websocket + configure cors socket request compatibility for ReactJS
const io = socketIo(server, { cors: corsConfig });


//middleware for http compatibility with ReactJS 
app.use(cors(corsConfig));


//Route imports
const indexRouter = require('./routes/index');
const createSessionRouter = require('./routes/session/create');
const joinSessionRouter = require('./routes/session/join');
const socketRoutes = require('./routes/socket')(io)
const templateRouter = require('./routes/template/template');


//Route Definitions
app.use('/', indexRouter);
app.use('/session/create', createSessionRouter);
app.use('/session/join', joinSessionRouter);
app.use('/path', templateRouter);


//App settings
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


//define express path
const rootDir = path.resolve(__dirname, '..');
app.use('/public', express.static(path.join(rootDir, '/public')));


// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.send({ 'error': `${err.status}: ${err.message}` });
});


//Listen to server on port
const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`click here uwu: ${config.be_host}/`)
})

//Start Garbage Collector
setInterval(async () => {
  await dbHandler.deleteSessionsOlderThan(config.gc_sessions_ttl_minutes);
}, config.gc_interval_minutes * 60 * 1000);


module.exports = app;