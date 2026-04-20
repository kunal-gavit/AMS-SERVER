import mongoose from "mongoose";

const studentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    branch: { type: String, required: true },
    year: { type: String, required: true },
    division: { type: String, required: true },
    rollNo: { type: String, required: true },
  },
  { timestamps: true }
);

studentProfileSchema.index({ rollNo: 1 }, { unique: true });

const StudentProfile = mongoose.model("StudentProfile", studentProfileSchema);
export default StudentProfile;
