import express from "express";
import { changePassword, getProfile, updateProfile } from "../controllers/profileController.js";
import { protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { changePasswordValidator, updateProfileValidator } from "../validators/profileValidators.js";

const router = express.Router();

router.get("/", protect, getProfile);
router.put("/", protect, updateProfileValidator, validateRequest, updateProfile);
router.put("/change-password", protect, changePasswordValidator, validateRequest, changePassword);

export default router;
