import bcrypt from "bcryptjs";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import FacultyProfile from "../models/FacultyProfile.js";
import {
  clearAuthCookies,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokenUtils.js";

const sanitizeUserResponse = async (userDoc) => {
  const user = await User.findById(userDoc._id).select("_id name email role profileImage");
  let profile = null;
  if (user?.role === "student") {
    profile = await StudentProfile.findOne({ userId: user._id }).select("branch year division rollNo");
  } else if (user?.role === "teacher") {
    profile = await FacultyProfile.findOne({ userId: user._id }).select("department designation subjects");
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage || "",
    profile,
  };
};

const issueAuthTokens = async (res, user) => {
  const payload = { id: user._id, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  user.refreshTokenHash = refreshTokenHash;
  user.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save();

  setAuthCookies(res, accessToken, refreshToken);
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    await issueAuthTokens(res, user);
    const responseUser = await sanitizeUserResponse(user);
    return res.json(responseUser);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, branch, year, division, rollNo, department, designation, subjects } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    if (role === "student" && (!branch || !year || !division || !rollNo)) {
      return res.status(400).json({ message: "branch, year, division and rollNo are required for students" });
    }

    const user = await User.create({ name, email, password, role });

    if (role === "student") {
      await StudentProfile.create({
        userId: user._id,
        branch,
        year,
        division,
        rollNo,
      });
    } else if (role === "teacher") {
      await FacultyProfile.create({
        userId: user._id,
        department: department || "",
        designation: designation || "",
        subjects: Array.isArray(subjects) ? subjects : [],
      });
    }

    await issueAuthTokens(res, user);
    const responseUser = await sanitizeUserResponse(user);

    return res.status(201).json(responseUser);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const responseUser = await sanitizeUserResponse(user);
    return res.json(responseUser);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token missing" });

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    if (user.refreshTokenExpiresAt.getTime() < Date.now()) {
      user.refreshTokenHash = null;
      user.refreshTokenExpiresAt = null;
      await user.save();
      clearAuthCookies(res);
      return res.status(401).json({ message: "Refresh token expired" });
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValid) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    await issueAuthTokens(res, user);
    const responseUser = await sanitizeUserResponse(user);
    return res.json(responseUser);
  } catch (error) {
    clearAuthCookies(res);
    return res.status(401).json({ message: "Invalid refresh session" });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        const user = await User.findById(decoded.id);
        if (user) {
          user.refreshTokenHash = null;
          user.refreshTokenExpiresAt = null;
          await user.save();
        }
      } catch {
        // no-op, just clear cookies
      }
    }

    clearAuthCookies(res);
    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    clearAuthCookies(res);
    return res.status(500).json({ message: error.message });
  }
};
