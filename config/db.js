import mongoose from "mongoose";

const connectWithUri = async (uri, label) => {
  const conn = await mongoose.connect(uri);
  console.log(`MongoDB Connected (${label}): ${conn.connection.host}`);
  return conn;
};

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const fallbackUri = process.env.MONGO_URI_LOCAL;

  if (!primaryUri && !fallbackUri) {
    console.error("Error: Missing MongoDB connection string. Set MONGO_URI or MONGO_URI_LOCAL in server/.env");
    process.exit(1);
  }

  try {
    if (primaryUri) {
      await connectWithUri(primaryUri, "primary");
      return;
    }
  } catch (primaryError) {
    console.error(`Primary MongoDB connection failed: ${primaryError.message}`);

    if (fallbackUri) {
      try {
        await connectWithUri(fallbackUri, "fallback");
        return;
      } catch (fallbackError) {
        console.error(`Fallback MongoDB connection failed: ${fallbackError.message}`);
      }
    }

    console.error("Database connection failed. Check your internet/Atlas network access or run local MongoDB and set MONGO_URI_LOCAL.");
    process.exit(1);
  }
};

export default connectDB;
