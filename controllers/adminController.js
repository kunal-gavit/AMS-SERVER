import Attendance from "../models/Attendance.js";
import Enrollment from "../models/Enrollment.js";
import Lecture from "../models/Lecture.js";
import StudentProfile from "../models/StudentProfile.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import { buildSubjectAnalytics } from "../services/analyticsService.js";

const buildStudentSearchResult = async (user) => {
  const profile = await StudentProfile.findOne({ userId: user._id });
  const enrollments = await Enrollment.find({ studentId: user._id }).populate("subjectId", "name code");

  const subjects = await Promise.all(
    enrollments
      .filter((item) => item.subjectId)
      .map(async (item) => {
        const records = await Attendance.find({ studentId: user._id, subjectId: item.subjectId._id }).sort({ createdAt: 1 });
        return {
          subjectId: item.subjectId._id,
          code: item.subjectId.code,
          ...buildSubjectAnalytics({
            subjectName: item.subjectId.name,
            attendanceRecords: records,
          }),
        };
      })
  );

  const total = subjects.reduce((acc, item) => acc + item.total, 0);
  const attended = subjects.reduce((acc, item) => acc + item.attended, 0);
  const percentage = total === 0 ? 0 : Number(((attended / total) * 100).toFixed(2));

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    branch: profile?.branch || "N/A",
    year: profile?.year || "N/A",
    division: profile?.division || "N/A",
    rollNo: profile?.rollNo || "N/A",
    analytics: {
      total,
      attended,
      percentage,
      subjects,
    },
  };
};

export const getSystemStats = async (req, res) => {
  try {
    const [totalStudents, totalTeachers, totalSubjects, totalRecords, totalLectures, totalEnrollments] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "teacher" }),
      Subject.countDocuments(),
      Attendance.countDocuments(),
      Lecture.countDocuments(),
      Enrollment.countDocuments(),
    ]);

    res.json({
      totalStudents,
      totalTeachers,
      totalSubjects,
      totalRecords,
      totalLectures,
      totalEnrollments,
      health: "Excellent",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const searchStudents = async (req, res) => {
  try {
    const query = (req.query.query || "").trim();
    if (!query) return res.status(400).json({ message: "query is required" });

    const users = await User.find({
      role: "student",
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    }).select("name email");

    const result = await Promise.all(users.map((user) => buildStudentSearchResult(user)));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().populate("facultyId", "name email").sort({ name: 1 });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createSubject = async (req, res) => {
  try {
    const { name, code, facultyId, branch, semester } = req.body;
    if (!name || !facultyId) return res.status(400).json({ message: "name and facultyId are required" });

    const teacher = await User.findOne({ _id: facultyId, role: "teacher" });
    if (!teacher) return res.status(404).json({ message: "Faculty not found" });

    const subject = await Subject.create({ name, code, facultyId, branch, semester });
    res.status(201).json(subject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (payload.facultyId) {
      const teacher = await User.findOne({ _id: payload.facultyId, role: "teacher" });
      if (!teacher) return res.status(404).json({ message: "Faculty not found" });
    }

    const subject = await Subject.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    res.json(subject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findByIdAndDelete(id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    await Promise.all([
      Enrollment.deleteMany({ subjectId: id }),
      Lecture.deleteMany({ subjectId: id }),
      Attendance.deleteMany({ subjectId: id }),
    ]);

    res.json({ message: "Subject deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllLectures = async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = subjectId ? { subjectId } : {};
    const lectures = await Lecture.find(filter).populate("subjectId", "name code").sort({ date: -1 });
    res.json(lectures);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createLecture = async (req, res) => {
  try {
    const { subjectId, date, startTime = "09:00", endTime = "10:00", topic = "" } = req.body;
    if (!subjectId) return res.status(400).json({ message: "subjectId is required" });

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    const lecture = await Lecture.create({
      subjectId,
      date: date ? new Date(date) : new Date(),
      startTime,
      endTime,
      topic,
      createdBy: req.user._id,
    });

    res.status(201).json(lecture);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateLecture = async (req, res) => {
  try {
    const { id } = req.params;
    const lecture = await Lecture.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });
    res.json(lecture);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteLecture = async (req, res) => {
  try {
    const { id } = req.params;
    const lecture = await Lecture.findByIdAndDelete(id);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });
    await Attendance.deleteMany({ lectureId: id });
    res.json({ message: "Lecture deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const enrollStudent = async (req, res) => {
  const { studentId, subjectId } = req.body;
  try {
    if (!studentId || !subjectId) return res.status(400).json({ message: "studentId and subjectId are required" });

    const student = await User.findOne({ _id: studentId, role: "student" });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    const existing = await Enrollment.findOne({ studentId, subjectId });
    if (existing) {
      return res.status(400).json({ message: "Student already enrolled in this subject" });
    }

    const enrollment = await Enrollment.create({ studentId, subjectId });
    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const listUsers = async (req, res) => {
  try {
    const role = req.query.role;
    const filter = role ? { role } : {};

    const users = await User.find(filter).select("name email role createdAt").sort({ createdAt: -1 });
    const studentIds = users.filter((user) => user.role === "student").map((user) => user._id);
    const profiles = await StudentProfile.find({ userId: { $in: studentIds } });

    const result = users.map((user) => ({
      ...user.toObject(),
      profile: user.role === "student" ? profiles.find((profile) => String(profile.userId) === String(user._id)) || null : null,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, branch, year, division, rollNo } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password, role are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ name, email, password, role });
    let profile = null;

    if (role === "student") {
      if (!branch || !year || !division || !rollNo) {
        return res.status(400).json({ message: "branch, year, division, rollNo are required for student" });
      }
      profile = await StudentProfile.create({ userId: user._id, branch, year, division, rollNo });
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, password, branch, year, division, rollNo } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (password) user.password = password;
    await user.save();

    let profile = await StudentProfile.findOne({ userId: user._id });

    if (user.role === "student") {
      if (!profile) {
        profile = await StudentProfile.create({
          userId: user._id,
          branch: branch || "CSE",
          year: year || "FE",
          division: division || "A",
          rollNo: rollNo || `${user._id}`.slice(-6),
        });
      } else {
        if (branch) profile.branch = branch;
        if (year) profile.year = year;
        if (division) profile.division = division;
        if (rollNo) profile.rollNo = rollNo;
        await profile.save();
      }
    } else if (profile) {
      await StudentProfile.deleteOne({ _id: profile._id });
      profile = null;
    }

    res.json({ _id: user._id, name: user.name, email: user.email, role: user.role, profile });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await Promise.all([
      StudentProfile.deleteMany({ userId: id }),
      Enrollment.deleteMany({ studentId: id }),
      Attendance.deleteMany({ studentId: id }),
      user.deleteOne(),
    ]);

    if (user.role === "teacher") {
      const subjects = await Subject.find({ facultyId: id }).select("_id");
      const subjectIds = subjects.map((subject) => subject._id);
      await Promise.all([
        Subject.deleteMany({ facultyId: id }),
        Lecture.deleteMany({ subjectId: { $in: subjectIds } }),
        Attendance.deleteMany({ subjectId: { $in: subjectIds } }),
        Enrollment.deleteMany({ subjectId: { $in: subjectIds } }),
      ]);
    }

    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
