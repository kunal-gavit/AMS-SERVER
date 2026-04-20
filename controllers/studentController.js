import Attendance from "../models/Attendance.js";
import Enrollment from "../models/Enrollment.js";
import Subject from "../models/Subject.js";
import { buildSubjectAnalytics, generateWeeklyBand, getStudentSubjectSummary, predictFuturePercentage } from "../services/analyticsService.js";

const getStudentEnrollmentsWithSubjects = async (studentId) => {
  return Enrollment.find({ studentId }).populate("subjectId", "name code");
};

export const getStudentAnalytics = async (req, res) => {
  try {
    const studentId = req.user._id;
    const enrollments = await getStudentEnrollmentsWithSubjects(studentId);

    const analytics = await Promise.all(
      enrollments
        .filter((enrollment) => enrollment.subjectId)
        .map(async (enrollment) => {
          const attendanceRecords = await Attendance.find({
            studentId,
            subjectId: enrollment.subjectId._id,
          }).sort({ createdAt: 1 });

          return buildSubjectAnalytics({
            subjectName: enrollment.subjectId.name,
            attendanceRecords,
          });
        })
    );

    return res.json(analytics);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;
    const enrollments = await getStudentEnrollmentsWithSubjects(studentId);

    const subjectStats = await Promise.all(
      enrollments
        .filter((enrollment) => enrollment.subjectId)
        .map(async (enrollment) => {
          const records = await Attendance.find({
            studentId,
            subjectId: enrollment.subjectId._id,
          }).sort({ createdAt: 1 });

          return {
            subjectId: enrollment.subjectId._id,
            code: enrollment.subjectId.code,
            ...buildSubjectAnalytics({
              subjectName: enrollment.subjectId.name,
              attendanceRecords: records,
            }),
          };
        })
    );

    const totalAttended = subjectStats.reduce((acc, item) => acc + item.attended, 0);
    const totalClasses = subjectStats.reduce((acc, item) => acc + item.total, 0);
    const overallPercentage = totalClasses === 0 ? 0 : Number(((totalAttended / totalClasses) * 100).toFixed(2));

    const history = await Attendance.find({ studentId })
      .populate("lectureId", "date")
      .sort({ createdAt: -1 })
      .limit(100)
      .select("status lectureId");

    const weeklyTrend = generateWeeklyBand(
      history
        .filter((entry) => entry.lectureId?.date)
        .map((entry) => ({
          date: entry.lectureId.date,
          status: entry.status,
        }))
    );

    return res.json({
      studentId,
      summary: {
        totalSubjects: subjectStats.length,
        totalAttended,
        totalClasses,
        overallPercentage,
      },
      weeklyTrend,
      subjectStats,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSubjectDetail = async (req, res) => {
  try {
    const studentId = req.user._id;
    const subjectId = req.params.id;

    const subject = await Subject.findById(subjectId).select("name code");
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    const attendanceRecords = await Attendance.find({ studentId, subjectId })
      .populate("lectureId", "date startTime endTime topic")
      .sort({ createdAt: -1 });

    const summary = await getStudentSubjectSummary(studentId, subjectId);

    return res.json({
      subject,
      summary,
      records: attendanceRecords,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAttendanceHistory = async (req, res) => {
  try {
    const studentId = req.user._id;

    const history = await Attendance.find({ studentId })
      .populate("subjectId", "name code")
      .populate("lectureId", "date startTime endTime")
      .sort({ createdAt: -1 })
      .limit(200);

    const formatted = history.map((row) => ({
      _id: row._id,
      subject: row.subjectId?.name || "Unknown",
      subjectCode: row.subjectId?.code || "",
      date: row.lectureId?.date || row.createdAt,
      startTime: row.lectureId?.startTime || "",
      endTime: row.lectureId?.endTime || "",
      status: row.status,
    }));

    return res.json(formatted);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const simulateWhatIf = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { subjectId, futureClasses = 0, expectedPresenceRate = 1 } = req.body;

    if (!subjectId) return res.status(400).json({ message: "subjectId is required" });

    const subject = await Subject.findById(subjectId).select("name code");
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    const records = await Attendance.find({ studentId, subjectId });
    const total = records.length;
    const attended = records.filter((row) => row.status === "Present").length;
    const currentPercentage = total === 0 ? 0 : Number(((attended / total) * 100).toFixed(2));

    const parsedFuture = Math.max(0, Number(futureClasses));
    const parsedRate = Math.min(1, Math.max(0, Number(expectedPresenceRate)));

    const predictedPercentage = predictFuturePercentage(attended, total, parsedFuture, parsedRate);

    return res.json({
      subject,
      current: {
        total,
        attended,
        percentage: currentPercentage,
      },
      simulation: {
        futureClasses: parsedFuture,
        expectedPresenceRate: parsedRate,
        predictedPercentage,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
