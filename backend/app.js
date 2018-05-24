const express    = require('express'),
      path       = require('path'),
      logger     = require('morgan'),
      bodyParser = require('body-parser'),
      routes     = require('./routes'),
      app         = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler print stack traces to console
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: err
  });
});

app.listen(3030, () => console.info('Server listening on port 3030!'));
