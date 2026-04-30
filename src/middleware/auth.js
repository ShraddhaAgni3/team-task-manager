const { getSafeUser, getUserByToken } = require('../auth');

class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function requireAuth(req, _res, next) {
  const user = getUserByToken(req);
  if (!user) return next(new ApiError(401, 'Authentication required'));
  req.user = user;
  req.safeUser = getSafeUser(user);
  return next();
}

function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'ADMIN') {
    return next(new ApiError(403, 'Admin access required'));
  }
  return next();
}

module.exports = {
  ApiError,
  requireAuth,
  requireAdmin,
};
