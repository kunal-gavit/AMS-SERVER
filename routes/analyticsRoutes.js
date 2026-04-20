import express from "express";
import { getPrediction, getStudentAnalyticsById, getSubjectAnalytics } from "../controllers/analyticsController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/student/:studentId", authorize("admin", "teacher"), getStudentAnalyticsById);
router.get("/subject/:subjectId", authorize("admin", "teacher"), getSubjectAnalytics);
router.post("/prediction", authorize("admin", "teacher"), getPrediction);

export default router;
