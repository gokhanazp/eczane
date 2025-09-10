// Flash messages yerine query parameters kullanımı

const getMessages = (req) => {
  const error = req.query.error ? [req.query.error] : [];
  const success = req.query.success ? [req.query.success] : [];
  
  return { error, success };
};

const redirectWithError = (res, url, message) => {
  const separator = url.includes('?') ? '&' : '?';
  res.redirect(`${url}${separator}error=${encodeURIComponent(message)}`);
};

const redirectWithSuccess = (res, url, message) => {
  const separator = url.includes('?') ? '&' : '?';
  res.redirect(`${url}${separator}success=${encodeURIComponent(message)}`);
};

module.exports = {
  getMessages,
  redirectWithError,
  redirectWithSuccess
};
