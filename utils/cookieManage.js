/**
 * Cookie names for the application
 * @enum {string}
 */
const CookieNames = {
  SELECTED_CITY: "selectedCity",
  SELECTABLE_DISTRICTS: "selectableDistricts",
};

const getCookie = (req, cookieName) => {
  return req.cookies[cookieName];
};

const setCookie = (res, cookieName, value) => {
  res.cookie(cookieName, value);
  return value;
};

const clearCookie = (res, cookieName) => {
  res.clearCookie(cookieName);
};

module.exports = {
  CookieNames,
  getCookie,
  setCookie,
  clearCookie,
};
