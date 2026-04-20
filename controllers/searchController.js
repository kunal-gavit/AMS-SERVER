import Enrollment from "../models/Enrollment.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import Attendance from "../models/Attendance.js";
import { buildSubjectAnalytics } from "../services/analyticsService.js";

export const searchStudentsWithAnalytics = async (req, res) => {
  try {
    const rawQuery = (req.query.query || "").trim();
    if (!rawQuery) return res.status(400).json({ message: "query is required" });

    const users = await User.find({
      role: "student",
      $or: [
        { name: { $regex: rawQuery, $options: "i" } },
        { email: { $regex: rawQuery, $options: "i" } },
      ],
    }).select("_id name email");

    const userIds = users.map((user) => user._id);
    const profiles = await StudentProfile.find({ userId: { $in: userIds } });

    const result = await Promise.all(
      users.map(async (user) => {
        const profile = profiles.find((item) => String(item.userId) === String(user._id));
        const enrollments = await Enrollment.find({ studentId: user._id }).populate("subjectId", "name");

        const subjectAnalytics = await Promise.all(
          enrollments
            .filter((item) => item.subjectId)
            .map(async (item) => {
              const attendance = await Attendance.find({
                studentId: user._id,
                subjectId: item.subjectId._id,
              }).sort({ createdAt: 1 });

              return buildSubjectAnalytics({
                subjectName: item.subjectId.name,
                attendanceRecords: attendance,
              });
            })
        );

        const totalClasses = subjectAnalytics.reduce((acc, item) => acc + item.total, 0);
        const totalAttended = subjectAnalytics.reduce((acc, item) => acc + item.attended, 0);

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          branch: profile?.branch || "N/A",
          year: profile?.year || "N/A",
          division: profile?.division || "N/A",
          rollNo: profile?.rollNo || "N/A",
          analytics: {
            totalSubjects: subjectAnalytics.length,
            totalClasses,
            totalAttended,
            overallPercentage: totalClasses === 0 ? 0 : Number(((totalAttended / totalClasses) * 100).toFixed(2)),
            subjects: subjectAnalytics,
          },
        };
      })
    );

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
