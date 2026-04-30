const { ZodError } = require('zod');

function notFound(_req, _res, next) {
  const error = new Error('Route not found');
  error.status = 404;
  next(error);
}

function errorHandler(error, req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(422).json({
      error: {
        status: 422,
        title: 'Validation failed',
        message: 'Please fix the highlighted fields.',
        details: error.flatten(),
        path: req.originalUrl,
      },
    });
  }

  const status = error.status || 500;
  const safeMessage = status >= 500 ? 'Unexpected server error' : error.message;

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json({
    error: {
      status,
      title: status >= 500 ? 'Server error' : 'Request failed',
      message: safeMessage,
      details: error.details || null,
      path: req.originalUrl,
    },
  });
}

module.exports = {
  notFound,
  errorHandler,
};
