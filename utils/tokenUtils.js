import jwt from "jsonwebtoken";

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

export const signAccessToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRY });

export const signRefreshToken = (payload) => jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: REFRESH_EXPIRY });

export const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

export const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};

export const getAccessCookieOptions = () => ({
  ...authCookieOptions,
  maxAge: 15 * 60 * 1000,
});

export const getRefreshCookieOptions = () => ({
  ...authCookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

export const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, getAccessCookieOptions());
  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());
};

export const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", authCookieOptions);
  res.clearCookie("refreshToken", authCookieOptions);
};
