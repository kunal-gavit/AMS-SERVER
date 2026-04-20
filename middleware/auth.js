import User from "../models/User.js";
import { verifyAccessToken } from "../utils/tokenUtils.js";

export const protect = async (req, res, next) => {
  let token = req.cookies?.accessToken;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  try {
    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = verifyAccessToken(token);
    req.user = await User.findById(decoded.id).select("-password -refreshTokenHash");
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user no longer exists" });
    }

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};
