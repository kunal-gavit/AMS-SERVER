import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import User from "../models/User.js";
import FacultyProfile from "../models/FacultyProfile.js";
import Subject from "../models/Subject.js";
import StudentProfile from "../models/StudentProfile.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const connect = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;
  if (!uri) throw new Error("Missing MONGO_URI or MONGO_URI_LOCAL in server/.env");
  await mongoose.connect(uri);
};

const uniqueStrings = (arr) => [...new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean))];

const migrate = async () => {
  await connect();
  console.log("Connected to MongoDB. Running profile migration...");

  const userProfileImageUpdate = await User.updateMany(
    { $or: [{ profileImage: { $exists: false } }, { profileImage: null }] },
    { $set: { profileImage: "" } }
  );

  const teachers = await User.find({ role: "teacher" }).select("_id name email");
  let createdFacultyProfiles = 0;
  let updatedFacultyProfiles = 0;

  for (const teacher of teachers) {
    const taught = await Subject.find({ facultyId: teacher._id, isActive: { $ne: false } }).select("name");
    const taughtNames = uniqueStrings(taught.map((s) => s.name));

    let profile = await FacultyProfile.findOne({ userId: teacher._id });
    if (!profile) {
      profile = await FacultyProfile.create({
        userId: teacher._id,
        department: "",
        designation: "",
        subjects: taughtNames,
      });
      createdFacultyProfiles += 1;
      continue;
    }

    const mergedSubjects = uniqueStrings([...(profile.subjects || []), ...taughtNames]);
    const nextDepartment = profile.department || "";
    const nextDesignation = profile.designation || "";

    const changed =
      nextDepartment !== profile.department ||
      nextDesignation !== profile.designation ||
      JSON.stringify(mergedSubjects) !== JSON.stringify(profile.subjects || []);

    if (changed) {
      profile.department = nextDepartment;
      profile.designation = nextDesignation;
      profile.subjects = mergedSubjects;
      await profile.save();
      updatedFacultyProfiles += 1;
    }
  }

  const students = await User.find({ role: "student" }).select("_id");
  const studentIds = students.map((s) => s._id);
  const studentProfiles = await StudentProfile.find({ userId: { $in: studentIds } }).select("userId");
  const profileUserIdSet = new Set(studentProfiles.map((sp) => String(sp.userId)));
  const missingStudentProfileCount = studentIds.filter((id) => !profileUserIdSet.has(String(id))).length;

  console.log("Profile migration completed.");
  console.log(
    JSON.stringify(
      {
        usersProfileImageBackfilled: userProfileImageUpdate.modifiedCount || 0,
        totalTeachers: teachers.length,
        facultyProfilesCreated: createdFacultyProfiles,
        facultyProfilesUpdated: updatedFacultyProfiles,
        studentProfilesMissing: missingStudentProfileCount,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  process.exit(0);
};

migrate().catch(async (error) => {
  console.error("Profile migration failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
