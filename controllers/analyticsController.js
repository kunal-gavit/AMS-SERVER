import Attendance from "../models/Attendance.js";
import Enrollment from "../models/Enrollment.js";
import Lecture from "../models/Lecture.js";
import Subject from "../models/Subject.js";
import { buildSubjectAnalytics, generateWeeklyBand, predictFuturePercentage } from "../services/analyticsService.js";

export const getSubjectAnalytics = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const subject = await Subject.findById(subjectId).select("name code");
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    const records = await Attendance.find({ subjectId }).sort({ createdAt: 1 });

    const grouped = new Map();
    records.forEach((row) => {
      const key = String(row.studentId);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });

    const students = Array.from(grouped.entries()).map(([studentId, list]) => ({
      studentId,
      ...buildSubjectAnalytics({ subjectName: subject.name, attendanceRecords: list }),
    }));

    const total = records.length;
    const attended = records.filter((row) => row.status === "Present").length;
    const percentage = total === 0 ? 0 : Number(((attended / total) * 100).toFixed(2));

    const lectureRecords = await Attendance.find({ subjectId }).populate("lectureId", "date").select("status lectureId");
    const weekly = generateWeeklyBand(
      lectureRecords
        .filter((item) => item.lectureId?.date)
        .map((item) => ({ date: item.lectureId.date, status: item.status }))
    );

    res.json({
      subject,
      overall: {
        total,
        attended,
        percentage,
        predictionNext5At80pct: predictFuturePercentage(attended, total, 5, 0.8),
      },
      weekly,
      students,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStudentAnalyticsById = async (req, res) => {
  try {
    const { studentId } = req.params;
    const enrollments = await Enrollment.find({ studentId }).populate("subjectId", "name code");

    const subjects = await Promise.all(
      enrollments
        .filter((entry) => entry.subjectId)
        .map(async (entry) => {
          const rows = await Attendance.find({ studentId, subjectId: entry.subjectId._id }).sort({ createdAt: 1 });
          return {
            subjectId: entry.subjectId._id,
            code: entry.subjectId.code,
            ...buildSubjectAnalytics({
              subjectName: entry.subjectId.name,
              attendanceRecords: rows,
            }),
          };
        })
    );

    res.json({ studentId, subjects });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPrediction = async (req, res) => {
  try {
    const { studentId, subjectId, futureLectures = 5, expectedPresenceRate = 0.8 } = req.body;
    if (!studentId || !subjectId) {
      return res.status(400).json({ message: "studentId and subjectId are required" });
    }

    const records = await Attendance.find({ studentId, subjectId });
    const total = records.length;
    const attended = records.filter((item) => item.status === "Present").length;
    const parsedFuture = Math.max(0, Number(futureLectures));
    const parsedRate = Math.max(0, Math.min(1, Number(expectedPresenceRate)));

    const projected = predictFuturePercentage(attended, total, parsedFuture, parsedRate);
    const lectureCount = await Lecture.countDocuments({ subjectId });

    res.json({
      current: {
        total,
        attended,
        percentage: total === 0 ? 0 : Number(((attended / total) * 100).toFixed(2)),
      },
      projection: {
        futureLectures: parsedFuture,
        expectedPresenceRate: parsedRate,
        projectedPercentage: projected,
      },
      lectureCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
