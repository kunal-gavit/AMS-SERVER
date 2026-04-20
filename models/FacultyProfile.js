import mongoose from "mongoose";

const facultyProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    department: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    subjects: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

const FacultyProfile = mongoose.model("FacultyProfile", facultyProfileSchema);
export default FacultyProfile;
