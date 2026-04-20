import express from "express";
import {
	getUserProfile,
	loginUser,
	logoutUser,
	refreshAccessToken,
	registerUser,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { loginValidator, registerValidator } from "../validators/authValidators.js";

const router = express.Router();

router.post("/register", registerValidator, validateRequest, registerUser);
router.post("/login", loginValidator, validateRequest, loginUser);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);
router.get("/profile", protect, getUserProfile);

export default router;
