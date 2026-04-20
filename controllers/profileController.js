import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import FacultyProfile from "../models/FacultyProfile.js";
import Subject from "../models/Subject.js";
import Attendance from "../models/Attendance.js";

const buildStudentAttendanceSummary = async (userId) => {
  const records = await Attendance.find({ studentId: userId }).select("status");
  const totalClasses = records.length;
  const attendedClasses = records.filter((row) => row.status === "Present").length;
  const percentage = totalClasses === 0 ? 0 : Number(((attendedClasses / totalClasses) * 100).toFixed(2));

  return { totalClasses, attendedClasses, percentage };
};

const mapProfileResponse = async (user) => {
  let extraDetails = {};
  let attendanceSummary = null;

  if (user.role === "student") {
    const studentProfile = await StudentProfile.findOne({ userId: user._id }).select("branch year division rollNo");
    extraDetails = {
      branch: studentProfile?.branch || "",
      year: studentProfile?.year || "",
      division: studentProfile?.division || "",
      rollNo: studentProfile?.rollNo || "",
    };
    attendanceSummary = await buildStudentAttendanceSummary(user._id);
  } else if (user.role === "teacher") {
    const facultyProfile = await FacultyProfile.findOne({ userId: user._id }).select("department designation subjects");
    const subjectsTaught = await Subject.find({ facultyId: user._id, isActive: { $ne: false } }).select("name code");
    extraDetails = {
      department: facultyProfile?.department || "",
      designation: facultyProfile?.designation || "",
      subjects: facultyProfile?.subjects || [],
      subjectsTaught,
    };
  }

  return {
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage || "",
    extraDetails,
    attendanceSummary,
  };
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("name email role profileImage");
    if (!user) return res.status(404).json({ message: "User not found" });

    const payload = await mapProfileResponse(user);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      name,
      profileImage,
      branch,
      year,
      division,
      rollNo,
      department,
      designation,
      subjects,
    } = req.body;

    if (typeof name === "string") user.name = name.trim();
    if (typeof profileImage === "string") user.profileImage = profileImage.trim();
    await user.save();

    if (user.role === "student") {
      const studentProfile = await StudentProfile.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            ...(branch !== undefined ? { branch } : {}),
            ...(year !== undefined ? { year } : {}),
            ...(division !== undefined ? { division } : {}),
            ...(rollNo !== undefined ? { rollNo } : {}),
          },
        },
        { new: true, upsert: true }
      );

      if (!studentProfile) {
        return res.status(500).json({ message: "Failed to update student profile" });
      }
    }

    if (user.role === "teacher") {
      await FacultyProfile.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            ...(department !== undefined ? { department } : {}),
            ...(designation !== undefined ? { designation } : {}),
            ...(subjects !== undefined ? { subjects } : {}),
          },
        },
        { new: true, upsert: true }
      );
    }

    const freshUser = await User.findById(user._id).select("name email role profileImage");
    const payload = await mapProfileResponse(freshUser);
    return res.json(payload);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Duplicate profile field value" });
    }
    return res.status(500).json({ message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) return res.status(400).json({ message: "Old password is incorrect" });

    user.password = newPassword;
    await user.save();

    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
