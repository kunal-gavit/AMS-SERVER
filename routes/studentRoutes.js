import express from "express";
import {
	getAttendanceHistory,
	getStudentAnalytics,
	getStudentDashboard,
	getSubjectDetail,
	simulateWhatIf,
} from "../controllers/studentController.js";
import { protect, authorize } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { simulateValidator } from "../validators/studentValidators.js";

const router = express.Router();

router.use(protect);
router.use(authorize("student"));

router.get("/dashboard", getStudentDashboard);
router.get("/analytics", getStudentAnalytics);
router.get("/history", getAttendanceHistory);
router.get("/subject/:id", getSubjectDetail);
router.post("/simulate", simulateValidator, validateRequest, simulateWhatIf);

export default router;
