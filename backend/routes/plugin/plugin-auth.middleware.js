function pluginAuth(req, res, next) {
  const validToken = process.env.PLUGIN_API_TOKEN;
  if (!validToken) {
    return res.status(500).json({
      success: false,
      message: 'PLUGIN_API_TOKEN is not configured'
    })
  }

  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    })
  }

  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'invalid authorization format'
    })
  }

  const token = authorization.slice(7);
  if (token !== validToken) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    })
  }

  req.pluginToken = token;

  next();

}

module.exports = {
  pluginAuth
};
