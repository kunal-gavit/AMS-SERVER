import express from "express";
import { searchStudentsWithAnalytics } from "../controllers/searchController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin", "teacher"));

router.get("/students", searchStudentsWithAnalytics);

export default router;
